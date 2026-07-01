from typing import Any

from infrastructure.log_util import normalize_messages


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
