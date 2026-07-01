import logging

from langchain_core.messages import HumanMessage, ToolMessage

from infrastructure.llm_context_log import log_llm_context


def test_log_llm_context_tools_only(caplog):
    caplog.set_level(logging.INFO, logger="shoppie.agent.llm_context")

    log_llm_context(
        "ctx-1",
        [
            ToolMessage(
                content='{"marketplace":"Yahoo","products":[{"title":"A","price":1000,"marketplace":"Yahoo"}]}',
                tool_call_id="call-1",
                name="search_yahoo_products_with_filters_tool",
            ),
            HumanMessage(content="一番高いのは？"),
        ],
    )

    messages = [record.message for record in caplog.records]
    assert any("tool=search_yahoo_products_with_filters_tool" in message for message in messages)
    assert any('user=\'一番高いのは？\'' in message for message in messages)
    assert not any('"role": "assistant"' in message for message in messages)
