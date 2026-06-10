import os
import requests
import json
import urllib.parse
from dotenv import load_dotenv

load_dotenv(override=True)

APP_ID = os.getenv("YAHOO_APP_ID")
AFFILIATE_ID = os.getenv("YAHOO_AFFILIATE_ID")
VC_SID = os.getenv("VC_SID")
VC_PID = os.getenv("VC_PID")

ITEM_SEARCH_URL = "https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch"

ALLOWED_SORT = {"-score", "+price", "-price", "-review_count"}
ALLOWED_CONDITION = {"new", "used"}
ALLOWED_SHIPPING = {"free", "conditional_free"}


def base_params():
    params = {
        "appid": APP_ID,
        "results": 50,
        "in_stock": "true",
        "image_size": 600,
    }
    if AFFILIATE_ID:
        params["affiliate_type"] = "vc"
        params["affiliate_id"] = AFFILIATE_ID
    return params


def build_api_params(filters: dict) -> dict:
    """Yahoo API v3 itemSearch 向けにフィルターを正規化する。"""
    params = {}
    for key, value in filters.items():
        if value is None:
            continue

        if key == "sort" and value not in ALLOWED_SORT:
            continue
        if key == "condition" and value not in ALLOWED_CONDITION:
            continue
        if key == "shipping" and value not in ALLOWED_SHIPPING:
            continue
        if key == "start" and (not isinstance(value, int) or value < 1):
            continue

        if isinstance(value, bool):
            params[key] = "true" if value else "false"
        else:
            params[key] = value

    return params


def _affiliate_url(original_url: str) -> str:
    if VC_SID and VC_PID and original_url:
        encoded_url = urllib.parse.quote_plus(original_url)
        return (
            f"https://ck.jp.ap.valuecommerce.com/servlet/referral?"
            f"sid={VC_SID}&pid={VC_PID}&vc_url={encoded_url}"
        )
    return original_url or "URLなし"


def _format_item(item: dict) -> dict:
    shipping = item.get("shipping", {})
    review = item.get("review", {})
    condition = item.get("condition", "")

    return {
        "title": item.get("name", "商品名不明"),
        "url": _affiliate_url(item.get("url", "")),
        "image": item.get("exImage", {}).get("url", "画像なし"),
        "price": str(item.get("price", "不明")),
        "description": item.get("description", "説明なし"),
        "condition": "新品" if condition == "new" else "中古" if condition == "used" else condition,
        "shipping": shipping.get("name", ""),
        "review_rate": review.get("rate"),
        "review_count": review.get("count"),
    }


def search_products_with_filters(keyword: str, filters: dict) -> str:
    params = base_params()
    params["query"] = keyword
    params.update(build_api_params(filters))

    response = requests.get(ITEM_SEARCH_URL, params=params, timeout=30)

    if response.status_code != 200:
        return json.dumps(
            {"error": f"商品検索に失敗しました。(HTTP {response.status_code})"},
            ensure_ascii=False,
        )

    data = response.json()
    items = data.get("hits", [])
    if not items:
        return json.dumps({"message": "商品が見つかりませんでした。"}, ensure_ascii=False)

    results = [_format_item(item) for item in items]
    return json.dumps(results, ensure_ascii=False, indent=2)
