import logging

from domain.entities.agent_response import AgentResponse
from domain.entities.product import Product
from domain.entities.user_utterance import UserUtterance
from infrastructure.gateways.langgraph.langgraph_agent import run_agent
from infrastructure.log_util import truncate
from infrastructure.session_store import (
    extract_assistant_message,
    extract_products_preview,
    session_store,
)

logger = logging.getLogger("shoppie.usecase.request_assistance")


def _parse_price(price_raw) -> int:
    if isinstance(price_raw, int):
        return price_raw
    digits = "".join(char for char in str(price_raw) if char.isdigit())
    return int(digits) if digits else 0


def _to_agent_response(raw: dict, fallback_message: str) -> AgentResponse:
    products = raw.get("parsed_tool_content")
    normalized_products: list[Product] = []
    if isinstance(products, list):
        for item in products:
            if not isinstance(item, dict):
                continue
            normalized_products.append(
                Product(
                    title=item.get("title", ""),
                    price=_parse_price(item.get("price", 0)),
                    image_urls=[item.get("image", "")] if item.get("image") else [],
                    affiliate_url=item.get("url", ""),
                    description=item.get("description"),
                )
            )

    message = extract_assistant_message(raw) or fallback_message
    return AgentResponse(message=message, products=normalized_products)


class RequestAssistanceUseCase:
    async def execute(self, utterance: UserUtterance) -> AgentResponse:
        logger.info(
            "request-assistance start thread_id=%s text=%r",
            utterance.context_id,
            truncate(utterance.text),
        )
        raw = await run_agent(utterance.text, thread_id=utterance.context_id)
        if "error" in raw:
            logger.error(
                "request-assistance failed thread_id=%s error=%s",
                utterance.context_id,
                raw.get("error"),
            )
            raise RuntimeError(str(raw.get("error")))

        response = _to_agent_response(
            raw,
            f"「{utterance.text}」へのおすすめ商品をご紹介します。",
        )
        session_store.record_turn(
            thread_id=utterance.context_id,
            user_message=utterance.text,
            assistant_message=response.message,
            product_count=len(response.products),
            products_preview=extract_products_preview(raw),
        )
        logger.info(
            "request-assistance done thread_id=%s products=%s",
            utterance.context_id,
            len(response.products),
        )
        return response
