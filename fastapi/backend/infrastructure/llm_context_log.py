import json
import logging
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from infrastructure.log_util import truncate

logger = logging.getLogger("shoppie.agent.llm_context")

MAX_LOG_CHARS = 32_000


def _parse_json_content(content: Any) -> Any:
    if isinstance(content, str):
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            return content
    return content


def serialize_message_for_log(message: Any) -> dict[str, Any]:
    if isinstance(message, HumanMessage):
        return {
            "role": "human",
            "content": str(message.content),
        }

    if isinstance(message, AIMessage):
        tool_calls = getattr(message, "tool_calls", None) or []
        return {
            "role": "assistant",
            "content": str(message.content or ""),
            "tool_calls": [
                call.get("name") if isinstance(call, dict) else getattr(call, "name", None)
                for call in tool_calls
            ],
        }

    if isinstance(message, ToolMessage):
        payload = _parse_json_content(message.content)
        entry: dict[str, Any] = {
            "role": "tool",
            "name": getattr(message, "name", None),
            "payload": payload,
        }
        if isinstance(payload, dict) and isinstance(payload.get("products"), list):
            products = payload["products"]
            entry["product_count"] = len(products)
            prices = [
                product.get("price_yen")
                for product in products
                if isinstance(product, dict) and product.get("price_yen") is not None
            ]
            if prices:
                entry["price_yen_min"] = min(prices)
                entry["price_yen_max"] = max(prices)
        return entry

    return {
        "role": type(message).__name__,
        "content": truncate(str(getattr(message, "content", "")), 500),
    }


def log_llm_context(thread_id: str, messages: list) -> None:
    """Bedrock に渡す直前のメッセージ（圧縮済み ToolMessage 含む）をログに出す。"""
    serialized = [serialize_message_for_log(message) for message in messages]
    payload = json.dumps(serialized, ensure_ascii=False)

    if len(payload) > MAX_LOG_CHARS:
        payload = payload[: MAX_LOG_CHARS - 20] + "…(truncated)"

    logger.info(
        "llm context thread_id=%s message_count=%s payload=%s",
        thread_id,
        len(serialized),
        payload,
    )
