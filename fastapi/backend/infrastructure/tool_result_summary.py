import json
from typing import Any

from langchain_core.messages import HumanMessage, ToolMessage

MAX_LLM_TITLE_CHARS = 80

TOOL_MARKETPLACE = {
    "search_yahoo_products_with_filters_tool": "yahoo",
    "search_rakuten_products_with_filters_tool": "rakuten",
    "search_amazon_products_with_filters_tool": "amazon",
}

MARKETPLACE_LABELS = {
    "yahoo": "Yahoo",
    "rakuten": "楽天",
    "amazon": "Amazon",
}


def _parse_tool_content(content: Any) -> Any:
    if isinstance(content, str):
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            return content
    return content


def _marketplace_label(code: str | None) -> str | None:
    if not code:
        return None
    return MARKETPLACE_LABELS.get(code.lower(), code)


def _clip_title(title: str) -> str:
    text = (title or "").strip()
    if len(text) <= MAX_LLM_TITLE_CHARS:
        return text
    return text[: MAX_LLM_TITLE_CHARS - 1] + "…"


def _normalize_price(price: Any) -> int | None:
    if isinstance(price, int):
        return price if price >= 0 else None
    if isinstance(price, float):
        value = int(price)
        return value if value >= 0 else None
    digits = "".join(char for char in str(price) if char.isdigit())
    if not digits:
        return None
    return int(digits)


def _compact_product(item: dict, default_marketplace: str | None) -> dict[str, Any]:
    item_marketplace = item.get("marketplace")
    marketplace = _marketplace_label(
        item_marketplace.lower() if isinstance(item_marketplace, str) else None
    ) or default_marketplace

    compact: dict[str, Any] = {
        "title": _clip_title(str(item.get("title", ""))),
        "marketplace": marketplace or "不明",
    }

    price = _normalize_price(item.get("price"))
    if price is not None:
        compact["price"] = price

    return compact


def summarize_tool_payload(payload: Any, tool_name: str | None = None) -> dict[str, Any]:
    """ツール結果を title / price / marketplace のみに圧縮する。"""
    marketplace = TOOL_MARKETPLACE.get(tool_name or "")
    label = _marketplace_label(marketplace)

    if isinstance(payload, dict):
        if payload.get("error"):
            summary: dict[str, Any] = {"error": str(payload["error"])}
            if label:
                summary["marketplace"] = label
            return summary

        if payload.get("is_amazon_search_link"):
            return {
                "marketplace": label or "Amazon",
                "products": [_compact_product(payload, label or "Amazon")],
            }

        message = payload.get("message")
        if message and not payload.get("products"):
            summary = {"products": [], "message": str(message)}
            if label:
                summary["marketplace"] = label
            return summary

        nested_products = payload.get("products")
        if isinstance(nested_products, list):
            payload = nested_products

    if isinstance(payload, list):
        products = [
            _compact_product(item, label)
            for item in payload
            if isinstance(item, dict)
        ]

        summary: dict[str, Any] = {"products": products}
        if label:
            summary["marketplace"] = label
        elif products:
            summary["marketplace"] = products[0].get("marketplace")
        return summary

    if isinstance(payload, str) and payload.strip():
        return {"products": [], "message": payload.strip()[:200]}

    return {"products": []}


def summarize_tool_message(message: ToolMessage) -> ToolMessage:
    tool_name = getattr(message, "name", None)
    payload = _parse_tool_content(message.content)
    summary = summarize_tool_payload(payload, tool_name)
    return ToolMessage(
        content=json.dumps(summary, ensure_ascii=False),
        tool_call_id=message.tool_call_id,
        name=tool_name,
    )


def _latest_tool_message_indices(messages: list) -> set[int]:
    indices: list[int] = []
    for i in range(len(messages) - 1, -1, -1):
        if isinstance(messages[i], ToolMessage):
            indices.append(i)
        elif indices:
            break
    return set(indices)


def _last_human(messages: list) -> HumanMessage | None:
    for message in reversed(messages):
        if isinstance(message, HumanMessage):
            return message
    return None


def messages_for_llm(messages: list) -> list:
    """LLM には直近ツール結果と最新のユーザー発言だけ渡す。"""
    result = []
    latest_tool_indices = _latest_tool_message_indices(messages)

    for i in sorted(latest_tool_indices):
        result.append(summarize_tool_message(messages[i]))

    human = _last_human(messages)
    if human:
        result.append(human)

    return result
