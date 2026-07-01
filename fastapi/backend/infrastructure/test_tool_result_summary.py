from infrastructure.tool_result_summary import summarize_tool_payload


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
    assert summary["products"][0]["price"] == "3980"
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
