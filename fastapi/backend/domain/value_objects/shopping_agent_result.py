from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class ShoppingAgentResult:
    assistant_message: str
    parsed_tool_content: list[dict] | None
    error: str | None = None
    # プロンプト・モデル・ツール定義から作る識別子。反応を構成ごとに比べるために返答へ載せる
    config_version: str = "unknown"
