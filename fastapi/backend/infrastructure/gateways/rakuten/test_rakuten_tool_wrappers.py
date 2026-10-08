import requests

from infrastructure.gateways.rakuten import rakuten_tool_wrappers
from infrastructure.gateways.rakuten.rakuten_tool_wrappers import (
    REQUEST_FAILED_MESSAGE,
    SEARCH_FAILED_MESSAGE,
    search_rakuten_products_with_filters_tool,
)

SECRET_URL = "/ichibams/api/IchibaItem/Search/20260401?applicationId=dummyapp&accessKey=dummysecret"


def test_connection_error_does_not_leak_credentials(monkeypatch):
    def raise_connection_error(keyword, filters):
        raise requests.ConnectionError(f"Max retries exceeded with url: {SECRET_URL}")

    monkeypatch.setattr(rakuten_tool_wrappers.rakuten_api, "search_products_with_filters", raise_connection_error)

    result = search_rakuten_products_with_filters_tool.invoke({"keyword": "x", "filters": {}})

    assert result == {"error": REQUEST_FAILED_MESSAGE}
    assert "dummysecret" not in str(result)


def test_unexpected_error_does_not_leak_message(monkeypatch):
    def raise_value_error(keyword, filters):
        raise ValueError(f"unexpected {SECRET_URL}")

    monkeypatch.setattr(rakuten_tool_wrappers.rakuten_api, "search_products_with_filters", raise_value_error)

    result = search_rakuten_products_with_filters_tool.invoke({"keyword": "x", "filters": {}})

    assert result == {"error": SEARCH_FAILED_MESSAGE}
