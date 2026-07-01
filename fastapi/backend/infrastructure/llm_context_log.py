import json
import logging
from typing import Any

from langchain_core.messages import HumanMessage, ToolMessage

logger = logging.getLogger("shoppie.agent.llm_context")


def _parse_json_content(content: Any) -> Any:
    if isinstance(content, str):
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            return content
    return content


def log_llm_context(thread_id: str, messages: list) -> None:
    """Bedrock に渡す直前の LLM 入力をログに出す（ツール結果中心）。"""
    tool_messages = [message for message in messages if isinstance(message, ToolMessage)]
    human = next((message for message in reversed(messages) if isinstance(message, HumanMessage)), None)

    if not tool_messages and human is None:
        logger.info("llm context thread_id=%s empty", thread_id)
        return

    if human is not None:
        logger.info(
            "llm context thread_id=%s user=%r",
            thread_id,
            str(human.content),
        )

    if not tool_messages:
        logger.info("llm context thread_id=%s tools=0", thread_id)
        return

    for message in tool_messages:
        payload = _parse_json_content(message.content)
        logger.info(
            "llm context thread_id=%s tool=%s\n%s",
            thread_id,
            getattr(message, "name", None),
            json.dumps(payload, ensure_ascii=False, indent=2),
        )
