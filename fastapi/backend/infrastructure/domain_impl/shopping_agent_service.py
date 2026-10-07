from domain.services.shopping_agent_service import ShoppingAgentService
from domain.value_objects.shopping_agent_result import ShoppingAgentResult
from infrastructure.gateways.langgraph.agent_response import extract_assistant_message
from infrastructure.gateways.langgraph.langgraph_agent import AGENT_CONFIG_VERSION, run_agent


class LangGraphShoppingAgentService:
    async def run(self, user_text: str, thread_id: str) -> ShoppingAgentResult:
        raw = await run_agent(user_text, thread_id=thread_id)
        if "error" in raw:
            return ShoppingAgentResult(
                assistant_message="",
                parsed_tool_content=None,
                error=str(raw.get("error")),
                config_version=AGENT_CONFIG_VERSION,
            )

        parsed = raw.get("parsed_tool_content")
        products = parsed if isinstance(parsed, list) else None
        return ShoppingAgentResult(
            assistant_message=extract_assistant_message(raw),
            parsed_tool_content=products,
            error=None,
            config_version=AGENT_CONFIG_VERSION,
        )
