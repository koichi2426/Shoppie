import json
from copy import deepcopy

import pytest

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from infrastructure.gateways.langgraph.tool_result_summary import messages_for_llm, summarize_tool_payload


def test_compact_all_products():
    payload = [
        {
            "title": "牛ヒレ肉 ステーキ用 200g",
            "price": "3980",
            "url": "https://example.com/a",
            "image": "https://example.com/img.jpg",
            "description": "長い説明文" * 20,
            "marketplace": "yahoo",
        },
        {
            "title": "国産牛ヒレ 150g",
            "price": "2980",
            "marketplace": "yahoo",
        },
    ]

    summary = summarize_tool_payload(
        payload,
        "search_yahoo_products_with_filters_tool",
    )

    assert summary["marketplace"] == "Yahoo"
    assert summary["count"] == 2
    assert len(summary["products"]) == 2
    assert summary["products"][0]["title"] == "牛ヒレ肉 ステーキ用 200g"
    assert summary["products"][0]["price_yen"] == 3980
    assert "url" not in summary["products"][0]
    assert "description" not in summary["products"][0]
    assert "image" not in summary["products"][0]


def test_compact_many_products_not_truncated():
    payload = [{"title": f"商品{i}", "price": str(i * 100)} for i in range(25)]

    summary = summarize_tool_payload(payload, "search_yahoo_products_with_filters_tool")

    assert summary["count"] == 25
    assert len(summary["products"]) == 25


@pytest.mark.parametrize("comparison", [
    {"review_rate": 4.5, "review_count": 120, "shipping": "送料無料", "condition": "新品"},
    {"review_rate": 0, "review_count": 0, "shipping": "条件付き送料無料", "condition": "中古"},
    {"review_rate": None, "review_count": None, "shipping": "", "condition": None},
])
def test_comparison_values_preserved_without_changing_card_data(comparison):
    payload = [{
        "title": "商品A",
        "price": "1,980円",
        "marketplace": "yahoo",
        "url": "https://example.com/product",
        "image": "https://example.com/image.jpg",
        "description": "商品カード用の詳細説明",
        "store": "ストア情報",
        "unexpected": "共有対象外のデータ",
        **comparison,
    }]
    original = deepcopy(payload)

    product = summarize_tool_payload(payload)["products"][0]

    assert product == {
        "title": "商品A", "price_yen": 1980, "marketplace": "Yahoo", **comparison,
    }
    assert payload == original


@pytest.mark.parametrize("marketplace,label,comparison", [
    ("yahoo", "Yahoo", {"review_rate": 4.5, "review_count": 12, "shipping": "送料無料", "condition": "新品"}),
    ("rakuten", "楽天", {"review_rate": 4.2, "review_count": 20}),
    ("amazon", "Amazon", {}),
])
def test_unprovided_marketplace_fields_stay_absent(marketplace, label, comparison):
    payload = {"products": [{
        "title": "商品A", "price": "1000", "marketplace": marketplace, **comparison,
    }]}

    summary = summarize_tool_payload(payload, f"search_{marketplace}_products_with_filters_tool")

    assert summary["marketplace"] == label
    assert summary["products"] == [{
        "title": "商品A", "price_yen": 1000, "marketplace": label, **comparison,
    }]


@pytest.mark.parametrize("as_list", [False, True])
def test_amazon_search_link_remains_distinguishable_from_real_products(as_list):
    payload = {
        "title": "Amazonで検索",
        "price": "0",
        "marketplace": "amazon",
        "is_amazon_search_link": True,
        "url": "https://www.amazon.co.jp/s?k=test",
    }
    summary = summarize_tool_payload([payload] if as_list else payload, "search_amazon_products_with_filters_tool")

    assert summary["count"] == 1
    assert summary["products"] == [{
        "title": "Amazonで検索", "price": "0", "marketplace": "Amazon", "amazon_search_link": True,
    }]
    assert "price_yen" not in summary["products"][0]


@pytest.mark.parametrize("length", [79, 80, 81])
def test_title_limit_matches_measured_policy(length):
    product = summarize_tool_payload([{"title": "あ" * length, "price": "1000"}])["products"][0]

    assert product["title"] == ("あ" * length if length <= 80 else "あ" * 79 + "…")


def test_summarize_error():
    summary = summarize_tool_payload(
        {"error": "API失敗"},
        "search_rakuten_products_with_filters_tool",
    )

    assert summary["error"] == "API失敗"
    assert summary["marketplace"] == "楽天"


def test_summarize_empty_message():
    summary = summarize_tool_payload(
        {"message": "商品が見つかりませんでした。"},
        "search_yahoo_products_with_filters_tool",
    )

    assert summary["count"] == 0
    assert summary["products"] == []
    assert summary["message"] == "商品が見つかりませんでした。"


def test_messages_for_llm_keeps_only_latest_tool_batch():
    messages = [
        HumanMessage(content="牛ヒレ肉"),
        ToolMessage(
            content='{"count":1,"products":[{"title":"古い結果","price_yen":1000}]}',
            tool_call_id="call-old",
            name="search_yahoo_products_with_filters_tool",
        ),
        AIMessage(content="見つけたよ"),
        HumanMessage(content="豚肉も探して"),
        ToolMessage(
            content='{"count":1,"products":[{"title":"新しい結果","price_yen":2000}]}',
            tool_call_id="call-yahoo",
            name="search_yahoo_products_with_filters_tool",
        ),
        ToolMessage(
            content='{"count":1,"products":[{"title":"新しい楽天","price_yen":1500}]}',
            tool_call_id="call-rakuten",
            name="search_rakuten_products_with_filters_tool",
        ),
    ]

    llm_messages = messages_for_llm(messages)

    assert len(llm_messages) == 5
    assert not any(
        isinstance(m, ToolMessage) and "古い結果" in str(m.content)
        for m in llm_messages
    )
    tool_payloads = [
        json.loads(m.content)
        for m in llm_messages
        if isinstance(m, ToolMessage)
    ]
    assert len(tool_payloads) == 2
    assert tool_payloads[0]["products"][0]["title"] == "新しい結果"
    assert tool_payloads[1]["products"][0]["title"] == "新しい楽天"


def test_messages_for_llm_keeps_latest_tools_for_follow_up_question():
    messages = [
        HumanMessage(content="牛ヒレ肉"),
        ToolMessage(
            content='{"count":2,"products":[{"title":"A","price":"5000"},{"title":"B","price":"16800"}]}',
            tool_call_id="call-1",
            name="search_yahoo_products_with_filters_tool",
        ),
        AIMessage(content="見つけたよ"),
        HumanMessage(content="この中で一番高いやつは？"),
    ]

    llm_messages = messages_for_llm(messages)

    tool_messages = [m for m in llm_messages if isinstance(m, ToolMessage)]
    assert len(tool_messages) == 1
    payload = json.loads(tool_messages[0].content)
    assert payload["count"] == 2
    assert payload["products"][1]["price_yen"] == 16800


def test_follow_up_questions_keep_review_and_shipping_evidence():
    content = json.dumps([{
        "title": "商品A", "price": "5000", "review_rate": 4.8, "review_count": 50,
        "shipping": "条件付き送料無料", "condition": "新品", "description": "詳細説明",
    }], ensure_ascii=False)
    original_tool = ToolMessage(
        content=content, tool_call_id="call-1", name="search_yahoo_products_with_filters_tool",
    )
    messages = [
        HumanMessage(content="商品を探して"), original_tool,
        AIMessage(content="見つけたよ"), HumanMessage(content="評価4以上で送料も無料のものは？"),
    ]

    tools = [message for message in messages_for_llm(messages) if isinstance(message, ToolMessage)]

    assert len(tools) == 1
    assert tools[0].tool_call_id == "call-1"
    assert tools[0].name == original_tool.name
    assert json.loads(tools[0].content)["products"] == [{
        "title": "商品A", "price_yen": 5000, "review_rate": 4.8, "review_count": 50,
        "shipping": "条件付き送料無料", "condition": "新品",
    }]
    assert original_tool.content == content


def test_messages_for_llm_strips_orphaned_tool_calls():
    messages = [
        HumanMessage(content="牛ヒレ肉"),
        AIMessage(
            content="探してみるね",
            tool_calls=[
                {
                    "id": "call-old-1",
                    "name": "search_yahoo_products_with_filters_tool",
                    "args": {"keyword": "牛ヒレ肉"},
                },
            ],
        ),
        ToolMessage(
            content='{"count":1,"products":[{"title":"古い結果","price_yen":1000}]}',
            tool_call_id="call-old-1",
            name="search_yahoo_products_with_filters_tool",
        ),
        AIMessage(content="見つけたよ"),
        HumanMessage(content="豚肉も探して"),
        AIMessage(
            content="探すね",
            tool_calls=[
                {
                    "id": "call-new-1",
                    "name": "search_yahoo_products_with_filters_tool",
                    "args": {"keyword": "豚肉"},
                },
                {
                    "id": "call-new-2",
                    "name": "search_rakuten_products_with_filters_tool",
                    "args": {"keyword": "豚肉"},
                },
            ],
        ),
        ToolMessage(
            content='{"count":1,"products":[{"title":"新しい結果","price_yen":2000}]}',
            tool_call_id="call-new-1",
            name="search_yahoo_products_with_filters_tool",
        ),
        ToolMessage(
            content='{"count":1,"products":[{"title":"新しい楽天","price_yen":1500}]}',
            tool_call_id="call-new-2",
            name="search_rakuten_products_with_filters_tool",
        ),
    ]

    llm_messages = messages_for_llm(messages)

    ai_messages = [message for message in llm_messages if isinstance(message, AIMessage)]
    assert ai_messages[0].content == "探してみるね"
    assert not ai_messages[0].tool_calls
    assert len(ai_messages[-1].tool_calls) == 2
    assert not any(
        isinstance(message, ToolMessage) and "古い結果" in str(message.content)
        for message in llm_messages
    )


def test_history_is_limited_to_recent_turns():
    messages = []
    for turn in range(10):
        messages.append(HumanMessage(content=f"発話{turn}"))
        messages.append(AIMessage(content=f"返答{turn}"))

    result = messages_for_llm(messages, max_turns=3)

    assert [m.content for m in result] == ["発話7", "返答7", "発話8", "返答8", "発話9", "返答9"]
    assert isinstance(result[0], HumanMessage)


def test_history_window_keeps_current_turn_tool_results():
    messages = [HumanMessage(content="前の発話"), AIMessage(content="前の返答")]
    messages.append(HumanMessage(content="今の発話"))
    messages.append(AIMessage(content="", tool_calls=[{"id": "call-now", "name": "search_yahoo_products_with_filters_tool", "args": {}}]))
    messages.append(ToolMessage(content=json.dumps([{"title": "A", "price": "100", "marketplace": "yahoo"}]), tool_call_id="call-now", name="search_yahoo_products_with_filters_tool"))

    result = messages_for_llm(messages, max_turns=1)

    assert result[0].content == "今の発話"
    assert isinstance(result[-1], ToolMessage)
    assert result[-1].tool_call_id == "call-now"


def test_history_shorter_than_window_is_unchanged():
    messages = [HumanMessage(content="発話"), AIMessage(content="返答")]

    assert [m.content for m in messages_for_llm(messages)] == ["発話", "返答"]
