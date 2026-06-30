from yahoo_api import build_api_params, search_products_with_filters


def test_build_api_params():
    params = build_api_params(
        {
            "price_from": 1000,
            "price_to": 5000,
            "is_discounted": True,
            "sort": "-review_count",
            "condition": "new",
            "shipping": "free",
            "start": 51,
            "ignored": None,
        }
    )
    assert params["price_from"] == 1000
    assert params["price_to"] == 5000
    assert params["is_discounted"] == "true"
    assert params["sort"] == "-review_count"
    assert params["condition"] == "new"
    assert params["shipping"] == "free"
    assert params["start"] == 51
    assert "ignored" not in params


def test_build_api_params_skips_invalid_values():
    params = build_api_params(
        {
            "sort": "invalid",
            "condition": "broken",
            "shipping": "unknown",
            "start": 0,
        }
    )
    assert "sort" not in params
    assert "condition" not in params
    assert "shipping" not in params
    assert "start" not in params


def test_search_products_with_filters_smoke():
    filters = {
        "price_from": 3000,
        "price_to": 10000,
        "is_discounted": True,
        "sort": "-score",
        "condition": "new",
        "shipping": "free",
    }
    result = search_products_with_filters("イヤホン", filters)
    assert isinstance(result, str)
    assert "error" not in result.lower() or "商品" in result
