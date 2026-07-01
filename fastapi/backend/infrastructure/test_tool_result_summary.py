import json

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from infrastructure.tool_result_summary import messages_for_llm, summarize_tool_payload


def test_compact_all_products():
    payload = [
        {
            "title": "牛ヒレ肉 ステーキ用 200g",
            "price": "3980",
            "url": "https://example.com/a",
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
    assert len(summary["products"]) == 2
    assert summary["products"][0] == {
        "title": "牛ヒレ肉 ステーキ用 200g",
        "marketplace": "Yahoo",
        "price": 3980,
    }
    assert "count" not in summary
    assert "note" not in summary


def test_compact_many_products_not_truncated():
    payload = [{"title": f"商品{i}", "price": str(i * 100), "marketplace": "yahoo"} for i in range(25)]

    summary = summarize_tool_payload(payload, "search_yahoo_products_with_filters_tool")

    assert len(summary["products"]) == 25


def test_summarize_error():
    summary = summarize_tool_payload(
        {"error": "API失敗"},
        "search_rakuten_products_with_filters_tool",
    )

    assert summary == {"error": "API失敗", "marketplace": "楽天"}


def test_summarize_empty_message():
    summary = summarize_tool_payload(
        {"message": "商品が見つかりませんでした。"},
        "search_yahoo_products_with_filters_tool",
    )

    assert summary["products"] == []
    assert summary["message"] == "商品が見つかりませんでした。"


def test_messages_for_llm_only_latest_tools_and_last_human():
    messages = [
        HumanMessage(content="古い発言"),
        ToolMessage(
            content='{"products":[{"title":"古い結果","price":1000,"marketplace":"Yahoo"}]}',
            tool_call_id="call-old",
            name="search_yahoo_products_with_filters_tool",
        ),
        AIMessage(content="見つけたよ"),
        HumanMessage(content="豚肉も探して"),
        ToolMessage(
            content='{"products":[{"title":"新しい結果","price":2000,"marketplace":"Yahoo"}]}',
            tool_call_id="call-yahoo",
            name="search_yahoo_products_with_filters_tool",
        ),
        ToolMessage(
            content='{"products":[{"title":"新しい楽天","price":1500,"marketplace":"楽天"}]}',
            tool_call_id="call-rakuten",
            name="search_rakuten_products_with_filters_tool",
        ),
    ]

    llm_messages = messages_for_llm(messages)

    assert len(llm_messages) == 3
    assert isinstance(llm_messages[-1], HumanMessage)
    assert llm_messages[-1].content == "豚肉も探して"
    assert not any(isinstance(m, AIMessage) for m in llm_messages)
    tool_payloads = [json.loads(m.content) for m in llm_messages if isinstance(m, ToolMessage)]
    assert len(tool_payloads) == 2
    assert tool_payloads[0]["products"][0]["title"] == "新しい結果"


def test_messages_for_llm_follow_up_question():
    messages = [
        HumanMessage(content="牛ヒレ肉"),
        ToolMessage(
            content='{"products":[{"title":"A","price":5000,"marketplace":"Yahoo"},{"title":"B","price":16800,"marketplace":"Yahoo"}]}',
            tool_call_id="call-1",
            name="search_yahoo_products_with_filters_tool",
        ),
        AIMessage(content="見つけたよ"),
        HumanMessage(content="この中で一番高いやつは？"),
    ]

    llm_messages = messages_for_llm(messages)

    assert len(llm_messages) == 2
    assert llm_messages[-1].content == "この中で一番高いやつは？"
    payload = json.loads(llm_messages[0].content)
    assert payload["products"][1]["price"] == 16800


def test_messages_for_llm_human_only_before_search():
    messages = [HumanMessage(content="牛ヒレ肉 食べたい")]

    llm_messages = messages_for_llm(messages)

    assert len(llm_messages) == 1
    assert llm_messages[0].content == "牛ヒレ肉 食べたい"
