import logging
import time

from infrastructure.gateways.langgraph.langgraph_agent import count_products, run_agent
from infrastructure.log_util import truncate
from infrastructure.session_store import (
    extract_assistant_message,
    extract_products_preview,
    session_store,
)

logger = logging.getLogger("shoppie.usecase.chat")


class ChatUseCase:
    async def execute(self, user_input: str, thread_id: str) -> dict:
        logger.info(
            "chat start thread_id=%s message=%r",
            thread_id,
            truncate(user_input),
        )
        start = time.perf_counter()
        response = await run_agent(user_input, thread_id=thread_id)
        duration_ms = (time.perf_counter() - start) * 1000
        product_count = count_products(response.get("parsed_tool_content"))
        has_error = "error" in response

        if not has_error:
            session_store.record_turn(
                thread_id=thread_id,
                user_message=user_input,
                assistant_message=extract_assistant_message(response),
                product_count=product_count,
                products_preview=extract_products_preview(response),
            )

        logger.info(
            "chat done thread_id=%s duration_ms=%.0f products=%s events=%s error=%s",
            thread_id,
            duration_ms,
            product_count,
            len(response.get("complete_raw_events", [])),
            has_error,
        )
        if has_error:
            logger.error(
                "chat failed thread_id=%s error=%s",
                thread_id,
                response.get("error"),
            )
        return response
