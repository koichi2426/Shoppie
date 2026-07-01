import json

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from infrastructure.tool_result_summary import messages_for_llm, summarize_tool_payload


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
