import requests

from infrastructure.gateways.yahoo import yahoo_tool_wrappers
from infrastructure.gateways.yahoo.yahoo_tool_wrappers import (
    REQUEST_FAILED_MESSAGE,
    search_yahoo_products_with_filters_tool,
)


def test_connection_error_does_not_leak_appid(monkeypatch):
    def raise_connection_error(keyword, filters):
        raise requests.ConnectionError(
            "Max retries exceeded with url: /ShoppingWebService/V3/itemSearch?appid=dummyappid&query=x"
        )

    monkeypatch.setattr(yahoo_tool_wrappers.yahoo_api, "search_products_with_filters", raise_connection_error)

    result = search_yahoo_products_with_filters_tool.invoke({"keyword": "x", "filters": {}})

    assert result == {"error": REQUEST_FAILED_MESSAGE}
    assert "dummyappid" not in str(result)
