import pytest

from domain.value_objects.user_utterance import new_user_utterance
from domain.services.agent_response_assembly import AgentResponseAssemblyService
from domain.services.product_assembly import ProductAssemblyService
from domain.value_objects.agent_message import new_agent_message
from domain.value_objects.context_id import new_context_id
from domain.value_objects.price import new_price
from domain.value_objects.utterance_text import new_utterance_text


def test_new_context_id_rejects_empty():
    with pytest.raises(ValueError, match="must not be empty"):
        new_context_id("  ")


def test_new_utterance_text_rejects_empty():
    with pytest.raises(ValueError, match="must not be empty"):
        new_utterance_text("")


def test_new_price_rejects_negative():
    with pytest.raises(ValueError, match="non-negative"):
        new_price(-1)


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
