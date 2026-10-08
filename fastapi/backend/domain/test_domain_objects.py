import pytest

from domain.entities.conversation_thread import (
    ConversationRepository,
    new_conversation_thread,
)
from domain.value_objects.user_utterance import new_user_utterance
from domain.services.agent_response_assembly import AgentResponseAssemblyService
from domain.services.product_assembly import ProductAssemblyService
from domain.value_objects.agent_message import new_agent_message
from domain.value_objects.context_id import new_context_id
from domain.value_objects.price import new_price
from domain.value_objects.utterance_text import new_utterance_text
from domain.value_objects.interaction_event import (
    new_client_interaction_event,
    new_turn_completed_event,
)
from domain.value_objects.turn_id import issue_turn_id, new_turn_id


def test_new_context_id_rejects_empty():
    with pytest.raises(ValueError, match="must not be empty"):
        new_context_id("  ")


def test_new_utterance_text_rejects_empty():
    with pytest.raises(ValueError, match="must not be empty"):
        new_utterance_text("")


def test_new_price_rejects_negative():
    with pytest.raises(ValueError, match="non-negative"):
        new_price(-1)


def test_new_conversation_thread():
    thread = new_conversation_thread("ctx-1")
    assert thread.id.value == "ctx-1"


def test_new_user_utterance():
    utterance = new_user_utterance("ctx-1", "牛ヒレ肉")
    assert utterance.context_id.value == "ctx-1"
    assert utterance.text.value == "牛ヒレ肉"


def test_product_assembly_from_tool_item():
    service = ProductAssemblyService()
    product = service.from_tool_item(
        {
            "title": "牛ヒレ肉 ステーキ",
            "price": "3980",
            "image": "https://example.com/a.jpg",
            "url": "https://example.com/product",
            "marketplace": "yahoo",
        }
    )

    assert product is not None
    assert product.title.value == "牛ヒレ肉 ステーキ"
    assert product.price.yen == 3980
    assert product.marketplace is not None
    assert product.marketplace.label == "Yahoo"


def test_agent_response_assembly():
    service = AgentResponseAssemblyService()
    response = service.build(
        "見つけたよ！",
        [
            {
                "title": "牛ヒレ肉",
                "price": 5000,
                "url": "https://example.com/item",
                "marketplace": "rakuten",
            }
        ],
    )

    assert response.message.value == "見つけたよ！"
    assert len(response.products) == 1
    assert response.to_dict()["products"][0]["price"] == 5000


def test_new_agent_message_rejects_empty():
    with pytest.raises(ValueError, match="must not be empty"):
        new_agent_message("   ")


def test_new_turn_id_rejects_non_uuid():
    with pytest.raises(ValueError, match="UUID"):
        new_turn_id("turn-1")


def test_issue_turn_id_returns_normalized_uuid():
    turn_id = issue_turn_id()
    assert new_turn_id(turn_id.value.upper()) == turn_id


def test_product_click_requires_turn_id_and_positive_rank():
    with pytest.raises(ValueError, match="requires turn_id"):
        new_client_interaction_event("product_click", "ctx-1", rank=1)
    with pytest.raises(ValueError, match="at least 1"):
        new_client_interaction_event("product_click", "ctx-1", turn_id=issue_turn_id().value, rank=0)


def test_product_click_rejects_unknown_marketplace():
    with pytest.raises(ValueError, match="unsupported marketplace"):
        new_client_interaction_event(
            "product_click", "ctx-1", turn_id=issue_turn_id().value, rank=1, marketplace="メルカリ"
        )


def test_conversation_reset_allows_missing_turn_id():
    event = new_client_interaction_event("conversation_reset", "ctx-1")
    assert event.to_dict() == {"type": "conversation_reset", "context_id": "ctx-1"}


def test_turn_completed_event_counts_marketplaces():
    event = new_turn_completed_event("ctx-1", issue_turn_id(), "v1", ["yahoo", "yahoo", None], 1200)
    data = event.to_dict()
    assert data["product_count"] == 3
    assert data["marketplace_counts"] == {"unknown": 1, "yahoo": 2}
