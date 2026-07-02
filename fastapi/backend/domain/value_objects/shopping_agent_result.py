from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class ShoppingAgentResult:
    assistant_message: str
    parsed_tool_content: list[dict] | None
    error: str | None = None
