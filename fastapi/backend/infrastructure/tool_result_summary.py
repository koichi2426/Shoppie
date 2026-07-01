import json
from typing import Any

from langchain_core.messages import ToolMessage

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


def _compact_product(item: dict) -> dict[str, Any]:
    """1商品あたり LLM に渡す最小フィールドだけ残す。"""
    compact: dict[str, Any] = {
        "title": _clip_title(str(item.get("title", ""))),
    }

    price = item.get("price")
    if price not in (None, "", "不明"):
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


def messages_for_llm(messages: list) -> list:
    """チェックポイント上の履歴はフルデータのまま、LLM 入力だけ各商品を圧縮する。"""
    return [
        summarize_tool_message(message) if isinstance(message, ToolMessage) else message
        for message in messages
    ]
