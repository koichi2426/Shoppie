import logging

from domain.value_objects.user_utterance import UserUtterance
from domain.services.agent_response_assembly import AgentResponseAssemblyService
from domain.value_objects.agent_response import AgentResponse
from infrastructure.agent_response import compact_assistant_message, extract_assistant_message
from infrastructure.gateways.langgraph.langgraph_agent import run_agent
from infrastructure.log_util import truncate
from infrastructure.product_curation import curate_products

logger = logging.getLogger("shoppie.usecase.request_assistance")


def _to_agent_response(
    raw: dict,
    fallback_message: str,
    assembly: AgentResponseAssemblyService,
) -> AgentResponse:
    products = raw.get("parsed_tool_content")
    curated_items: list[dict] = []
    if isinstance(products, list):
        curated_items = curate_products(products)

    message = extract_assistant_message(raw) or fallback_message
    message = compact_assistant_message(message, len(curated_items))
    return assembly.build(message, curated_items)


class RequestAssistanceUseCase:
    def __init__(self, assembly: AgentResponseAssemblyService | None = None) -> None:
        self._assembly = assembly or AgentResponseAssemblyService()

    async def execute(self, utterance: UserUtterance) -> AgentResponse:
        logger.info(
            "request-assistance start thread_id=%s text=%r",
            utterance.context_id.value,
            truncate(utterance.text.value),
        )
        raw = await run_agent(utterance.text.value, thread_id=utterance.context_id.value)
        if "error" in raw:
            logger.error(
                "request-assistance failed thread_id=%s error=%s",
                utterance.context_id.value,
                raw.get("error"),
            )
            raise RuntimeError(str(raw.get("error")))

        response = _to_agent_response(
            raw,
            f"「{utterance.text.value}」、探してみるね！",
            self._assembly,
        )
        logger.info(
            "request-assistance done thread_id=%s products=%s",
            utterance.context_id.value,
            len(response.products),
        )
        return response
