import re
from typing import Any

from infrastructure.log_util import normalize_messages

MAX_MESSAGE_CHARS = 150
MAX_SENTENCES_WITH_PRODUCTS = 2
PRODUCT_LIST_FALLBACK = "おすすめの商品を見つけました。下のカードからご覧ください。"


def _split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[。！？!?])\s*", text.strip())
    return [part.strip() for part in parts if part.strip()]


def _looks_like_product_list(message: str) -> bool:
    if message.count("円") >= 2:
        return True
    if message.count("★") >= 1 or "送料" in message:
        return True
    numbered_items = re.findall(r"(?m)^\s*\d+[\.．)、]", message)
    return len(numbered_items) >= 2


def compact_assistant_message(message: str, product_count: int) -> str:
    text = message.strip()
    if not text:
        return text
    if product_count <= 0:
        return text

    if _looks_like_product_list(text):
        return PRODUCT_LIST_FALLBACK

    sentences = _split_sentences(text)
    if sentences:
        text = "".join(sentences[:MAX_SENTENCES_WITH_PRODUCTS])

    if len(text) > MAX_MESSAGE_CHARS:
        clipped = text[:MAX_MESSAGE_CHARS]
        last_period = max(clipped.rfind("。"), clipped.rfind("！"), clipped.rfind("？"))
        if last_period >= 40:
            text = clipped[: last_period + 1]
        else:
            text = clipped.rstrip() + "…"

    return text


def extract_assistant_message(response: dict[str, Any]) -> str:
    for event in reversed(response.get("complete_raw_events", [])):
        if "llm_agent" not in event:
            continue
        messages = normalize_messages(event["llm_agent"].get("messages", []))
        if not messages:
            continue
        last = messages[-1]
        content = getattr(last, "content", "") or ""
        if content:
            return content
    return ""
