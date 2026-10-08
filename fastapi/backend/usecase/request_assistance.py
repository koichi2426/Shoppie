import asyncio
import logging
import time
from dataclasses import dataclass
from typing import Protocol

from domain.services.shopping_agent_service import ShoppingAgentService
from domain.services.conversation_history import ConversationHistory, ConversationTurn
from domain.services.agent_message_policy import AgentMessagePolicy
from domain.services.agent_response_assembly import AgentResponseAssemblyService
from domain.services.interaction_event_recorder import InteractionEventRecorder
from domain.services.product_curation import ProductCurationService
from domain.value_objects.interaction_event import (
    MAX_DURATION_MS,
    InteractionEvent,
    new_turn_completed_event,
    new_turn_failed_event,
)
from domain.value_objects.turn_id import issue_turn_id
from domain.value_objects.user_utterance import new_user_utterance

logger = logging.getLogger("shoppie.usecase.request_assistance")


def _log_preview(text: str, max_len: int = 120) -> str:
    normalized = " ".join(text.split())
    if len(normalized) <= max_len:
        return normalized
    return normalized[: max_len - 3] + "..."


def _elapsed_ms(started_at: float) -> int:
    # 記録の検証で返答そのものを落とさないよう、上限で丸める
    return min(int((time.monotonic() - started_at) * 1000), MAX_DURATION_MS)


@dataclass(frozen=True, slots=True)
class RequestAssistanceInput:
    """ユースケース境界の入力（プリミティブ型）。"""

    text: str
    context_id: str


@dataclass(frozen=True, slots=True)
class RequestAssistanceOutput:
    """ユースケース境界の出力（プリミティブ型）。"""

    message: str
    products: list[dict]
    turn_id: str
    config_version: str


class RequestAssistancePresenter(Protocol):
    def output(self, result: RequestAssistanceOutput) -> dict:
        ...


class RequestAssistanceUseCase:
    def __init__(
        self,
        agent_service: ShoppingAgentService,
        presenter: RequestAssistancePresenter,
        product_curation: ProductCurationService | None = None,
        agent_response_assembly: AgentResponseAssemblyService | None = None,
        agent_message_policy: AgentMessagePolicy | None = None,
        event_recorder: InteractionEventRecorder | None = None,
        conversation_history: ConversationHistory | None = None,
    ) -> None:
        self._agent_service = agent_service
        self._event_recorder = event_recorder
        self._conversation_history = conversation_history
        self._presenter = presenter
        self._product_curation = product_curation or ProductCurationService()
        self._agent_response_assembly = agent_response_assembly or AgentResponseAssemblyService()
        self._agent_message_policy = agent_message_policy or AgentMessagePolicy()

    async def execute(self, input_data: RequestAssistanceInput) -> dict:
        utterance = new_user_utterance(input_data.context_id, input_data.text)
        turn_id = issue_turn_id()
        started_at = time.monotonic()

        logger.info(
            "request-assistance start thread_id=%s text=%r",
            utterance.context_id.value,
            _log_preview(utterance.text.value),
        )

        try:
            agent_result = await self._agent_service.run(
                utterance.text.value,
                utterance.context_id.value,
            )
        except Exception:
            await self._save_turn(ConversationTurn(
                utterance.context_id.value, turn_id.value, "unknown", utterance.text.value,
                "", [], "failed",
            ))
            raise
        if agent_result.error:
            await self._save_turn(ConversationTurn(
                utterance.context_id.value, turn_id.value, agent_result.config_version,
                utterance.text.value, "", [], "failed",
            ))
            self._record(
                new_turn_failed_event(
                    utterance.context_id.value,
                    turn_id,
                    agent_result.config_version,
                    _elapsed_ms(started_at),
                )
            )
            logger.error(
                "request-assistance failed thread_id=%s error=%s",
                utterance.context_id.value,
                agent_result.error,
            )
            raise RuntimeError(agent_result.error)

        curated_items: list[dict] = []
        if isinstance(agent_result.parsed_tool_content, list):
            curated_items = self._product_curation.curate(agent_result.parsed_tool_content)

        message = agent_result.assistant_message or f"「{utterance.text.value}」、探してみるね！"
        message = self._agent_message_policy.compact(message, len(curated_items))

        agent_response = self._agent_response_assembly.build(message, curated_items)
        output = RequestAssistanceOutput(
            message=agent_response.message.value,
            products=[product.to_dict() for product in agent_response.products],
            turn_id=turn_id.value,
            config_version=agent_result.config_version,
        )

        await self._save_turn(ConversationTurn(
            utterance.context_id.value, turn_id.value, agent_result.config_version,
            utterance.text.value, output.message, output.products,
        ))

        self._record(
            new_turn_completed_event(
                utterance.context_id.value,
                turn_id,
                agent_result.config_version,
                [
                    product.marketplace.code if product.marketplace else None
                    for product in agent_response.products
                ],
                _elapsed_ms(started_at),
            )
        )

        logger.info(
            "request-assistance done thread_id=%s products=%s",
            utterance.context_id.value,
            len(output.products),
        )

        return self._presenter.output(output)

    def _record(self, event: InteractionEvent) -> None:
        if self._event_recorder is not None:
            self._event_recorder.record(event)

    async def _save_turn(self, turn: ConversationTurn) -> None:
        if self._conversation_history is not None:
            await asyncio.to_thread(self._conversation_history.save_turn, turn)
