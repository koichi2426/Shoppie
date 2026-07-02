import logging
from dataclasses import dataclass
from typing import Protocol

from domain.services.shopping_agent_service import ShoppingAgentService
from domain.services.agent_message_policy import AgentMessagePolicy
from domain.services.agent_response_assembly import AgentResponseAssemblyService
from domain.services.product_curation import ProductCurationService
from domain.value_objects.user_utterance import new_user_utterance

logger = logging.getLogger("shoppie.usecase.request_assistance")


def _log_preview(text: str, max_len: int = 120) -> str:
    normalized = " ".join(text.split())
    if len(normalized) <= max_len:
        return normalized
    return normalized[: max_len - 3] + "..."


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
    ) -> None:
        self._agent_service = agent_service
        self._presenter = presenter
        self._product_curation = product_curation or ProductCurationService()
        self._agent_response_assembly = agent_response_assembly or AgentResponseAssemblyService()
        self._agent_message_policy = agent_message_policy or AgentMessagePolicy()

    async def execute(self, input_data: RequestAssistanceInput) -> dict:
        utterance = new_user_utterance(input_data.context_id, input_data.text)

        logger.info(
            "request-assistance start thread_id=%s text=%r",
            utterance.context_id.value,
            _log_preview(utterance.text.value),
        )

        agent_result = await self._agent_service.run(
            utterance.text.value,
            utterance.context_id.value,
        )
        if agent_result.error:
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
        )

        logger.info(
            "request-assistance done thread_id=%s products=%s",
            utterance.context_id.value,
            len(output.products),
        )

        return self._presenter.output(output)
