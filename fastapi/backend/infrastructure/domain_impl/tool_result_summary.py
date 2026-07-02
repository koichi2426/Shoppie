import json
from typing import Any

from langchain_core.messages import AIMessage, ToolMessage

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
    return MARKETPLACE_LABELS.get(code, code)


def _clip_title(title: str) -> str:
    text = (title or "").strip()
    if len(text) <= MAX_LLM_TITLE_CHARS:
        return text
    return text[: MAX_LLM_TITLE_CHARS - 1] + "…"


def _normalize_price_yen(price: Any) -> int | None:
    if isinstance(price, int):
        return price if price > 0 else None
    if isinstance(price, float):
        value = int(price)
        return value if value > 0 else None
    digits = "".join(char for char in str(price) if char.isdigit())
    if not digits:
        return None
    value = int(digits)
    return value if value > 0 else None


def _compact_product(item: dict) -> dict[str, Any]:
    """1商品あたり LLM に渡す最小フィールドだけ残す。"""
    compact: dict[str, Any] = {
        "title": _clip_title(str(item.get("title", ""))),
    }

    price = item.get("price")
    price_yen = _normalize_price_yen(price)
    if price_yen is not None:
        compact["price_yen"] = price_yen
    elif price not in (None, "", "不明"):
        compact["price"] = price

    if item.get("is_amazon_search_link"):
        compact["amazon_search_link"] = True

    item_marketplace = item.get("marketplace")
    if isinstance(item_marketplace, str) and item_marketplace:
        compact["marketplace"] = _marketplace_label(item_marketplace.lower()) or item_marketplace

    return compact


def summarize_tool_payload(payload: Any, tool_name: str | None = None) -> dict[str, Any]:
    """ツール結果の全件を LLM に渡しつつ、各商品のフィールドだけ最小化する。"""
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
                "count": 1,
                "products": [_compact_product(payload)],
            }

        message = payload.get("message")
        if message and not payload.get("products"):
            summary = {"count": 0, "message": str(message), "products": []}
            if label:
                summary["marketplace"] = label
            return summary

        nested_products = payload.get("products")
        if isinstance(nested_products, list):
            payload = nested_products

    if isinstance(payload, list):
        products = [
            _compact_product(item)
            for item in payload
            if isinstance(item, dict)
        ]

        if not products:
            summary = {
                "count": 0,
                "message": "商品が見つかりませんでした",
                "products": [],
            }
            if label:
                summary["marketplace"] = label
            return summary

        inferred = payload[0].get("marketplace") if isinstance(payload[0], dict) else None
        mp_label = _marketplace_label(inferred) or label

        summary = {
            "count": len(products),
            "products": products,
            "note": "詳細URL・画像はユーザーの画面カードに表示済み",
        }
        if mp_label:
            summary["marketplace"] = mp_label
        return summary

    if isinstance(payload, str) and payload.strip():
        return {"message": payload.strip()[:200], "products": []}

    return {"message": "ツール結果を解釈できませんでした", "products": []}


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
    """直近1回のツール実行で追加された ToolMessage のインデックスだけ返す。"""
    indices: list[int] = []
    for i in range(len(messages) - 1, -1, -1):
        if isinstance(messages[i], ToolMessage):
            indices.append(i)
        elif indices:
            break
    return set(indices)


def _tool_call_id(call: Any) -> str | None:
    if isinstance(call, dict):
        return call.get("id")
    return getattr(call, "id", None)


def _content_only_ai(message: AIMessage) -> AIMessage:
    content = message.content
    if isinstance(content, list):
        text_parts = [
            part.get("text", "")
            for part in content
            if isinstance(part, dict) and part.get("type") == "text"
        ]
        content = "".join(text_parts)
    return AIMessage(content=str(content or ""))


def messages_for_llm(messages: list) -> list:
    """LLM には直近ツール結果だけ渡す（各商品は最小フィールド）。"""
    latest_tool_indices = _latest_tool_message_indices(messages)
    kept_tool_call_ids = {
        messages[i].tool_call_id
        for i in latest_tool_indices
        if isinstance(messages[i], ToolMessage) and messages[i].tool_call_id
    }

    result = []
    for i, message in enumerate(messages):
        if isinstance(message, ToolMessage):
            if i in latest_tool_indices:
                result.append(summarize_tool_message(message))
            continue

        if isinstance(message, AIMessage):
            tool_calls = getattr(message, "tool_calls", None) or []
            if tool_calls:
                call_ids = [_tool_call_id(call) for call in tool_calls]
                if call_ids and all(call_id in kept_tool_call_ids for call_id in call_ids):
                    result.append(message)
                elif message.content:
                    result.append(_content_only_ai(message))
                continue

        result.append(message)
    return result
