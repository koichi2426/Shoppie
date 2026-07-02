import json

from langchain_core.messages import HumanMessage, ToolMessage

from infrastructure.gateways.langgraph.llm_context_log import log_llm_context, serialize_message_for_log


def test_serialize_tool_message_includes_payload():
    tool = ToolMessage(
        content=json.dumps(
            {
                "marketplace": "Yahoo",
                "count": 2,
                "products": [
                    {"title": "A", "price_yen": 1000},
                    {"title": "B", "price_yen": 2000},
                ],
            },
            ensure_ascii=False,
        ),
        tool_call_id="call-1",
        name="search_yahoo_products_with_filters_tool",
    )

    serialized = serialize_message_for_log(tool)

    assert serialized["role"] == "tool"
    assert serialized["product_count"] == 2
    assert serialized["price_yen_min"] == 1000
    assert serialized["price_yen_max"] == 2000


def test_log_llm_context_emits_info(caplog):
    import logging

    caplog.set_level(logging.INFO, logger="shoppie.agent.llm_context")

    log_llm_context(
        "ctx-1",
        [
            HumanMessage(content="この中で一番高いやつは？"),
            ToolMessage(
                content='{"count":1,"products":[{"title":"高い肉","price_yen":16800}]}',
                tool_call_id="call-1",
                name="search_yahoo_products_with_filters_tool",
            ),
        ],
    )

    assert any("llm context thread_id=ctx-1" in record.message for record in caplog.records)
