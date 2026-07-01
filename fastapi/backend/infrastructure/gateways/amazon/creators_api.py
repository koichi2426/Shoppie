"""
Amazon Creators API クライアント

公式: https://affiliate-program.amazon.com/creatorsapi/docs/
PA-API 5.0 廃止に伴う後継API（OAuth 2.0 / lowerCamelCase）
"""
import base64
import json
import logging
import os
import time
from typing import Any

import requests

logger = logging.getLogger("shoppie.amazon.creators")

CREATORS_API_BASE = "https://creatorsapi.amazon"
MARKETPLACE = os.getenv("AMAZON_MARKETPLACE", "www.amazon.co.jp")

CREDENTIAL_ID = os.getenv("AMAZON_CREATORS_CREDENTIAL_ID")
CREDENTIAL_SECRET = os.getenv("AMAZON_CREATORS_CREDENTIAL_SECRET")
PARTNER_TAG = os.getenv("AMAZON_PARTNER_TAG")
CREATORS_VERSION = os.getenv("AMAZON_CREATORS_VERSION", "2.3")

# v2.x: Cognito (日本は FE → 2.3 / us-west-2)
COGNITO_TOKEN_URLS = {
    "2.1": "https://creatorsapi.auth.us-east-1.amazoncognito.com/oauth2/token",
    "2.2": "https://creatorsapi.auth.eu-south-2.amazoncognito.com/oauth2/token",
    "2.3": "https://creatorsapi.auth.us-west-2.amazoncognito.com/oauth2/token",
}
LWA_TOKEN_URL_US = "https://api.amazon.com/auth/o2/token"
LWA_TOKEN_URL_JP = "https://api.amazon.co.jp/auth/o2/token"

_token_cache: dict[str, Any] = {}


def is_creators_configured() -> bool:
    return bool(CREDENTIAL_ID and CREDENTIAL_SECRET and PARTNER_TAG)


def _fetch_cognito_token() -> str:
    token_url = COGNITO_TOKEN_URLS.get(CREATORS_VERSION, COGNITO_TOKEN_URLS["2.3"])
    basic = base64.b64encode(f"{CREDENTIAL_ID}:{CREDENTIAL_SECRET}".encode()).decode()
    response = requests.post(
        token_url,
        headers={
            "Authorization": f"Basic {basic}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data="grant_type=client_credentials&scope=creatorsapi/default",
        timeout=15,
    )
    response.raise_for_status()
    return response.json()["access_token"]


def _lwa_token_url() -> str:
    if MARKETPLACE == "www.amazon.co.jp":
        return LWA_TOKEN_URL_JP
    return LWA_TOKEN_URL_US


def _fetch_lwa_token() -> str:
    response = requests.post(
        _lwa_token_url(),
        headers={"Content-Type": "application/json"},
        json={
            "grant_type": "client_credentials",
            "client_id": CREDENTIAL_ID,
            "client_secret": CREDENTIAL_SECRET,
            "scope": "creatorsapi::default",
        },
        timeout=15,
    )
    response.raise_for_status()
    return response.json()["access_token"]


def _get_access_token() -> str:
    cached = _token_cache.get("access_token")
    expires_at = _token_cache.get("expires_at", 0)
    if cached and expires_at > time.time() + 60:
        return cached

    if CREATORS_VERSION.startswith("3."):
        token = _fetch_lwa_token()
    else:
        token = _fetch_cognito_token()

    _token_cache["access_token"] = token
    _token_cache["expires_at"] = time.time() + 3500
    return token


def _authorization_header(token: str) -> str:
    # v2.x: Bearer + Version suffix / v3.x: Bearer only (Login with Amazon path)
    if CREATORS_VERSION.startswith("3."):
        return f"Bearer {token}"
    return f"Bearer {token}, Version {CREATORS_VERSION}"


def _creators_post(operation: str, body: dict) -> dict:
    token = _get_access_token()
    response = requests.post(
        f"{CREATORS_API_BASE}/catalog/v1/{operation}",
        headers={
            "Authorization": _authorization_header(token),
            "Content-Type": "application/json",
            "x-marketplace": MARKETPLACE,
        },
        json=body,
        timeout=20,
    )

    try:
        payload = response.json()
    except json.JSONDecodeError:
        payload = {"error": response.text[:300]}

    if response.status_code >= 400:
        message = payload
        if isinstance(payload, dict):
            errors = payload.get("errors") or payload.get("Errors")
            if errors:
                first = errors[0] if isinstance(errors, list) else errors
                if isinstance(first, dict):
                    message = first.get("message") or first.get("Message") or payload
        raise RuntimeError(str(message))

    return payload if isinstance(payload, dict) else {}


def _extract_price(item: dict) -> str:
    offers = item.get("offersV2") or item.get("OffersV2") or {}
    listings = offers.get("listings") or offers.get("Listings") or []
    if not listings:
        return "0"

    price = listings[0].get("price") or listings[0].get("Price") or {}
    money = price.get("money") or price.get("Money") or {}
    amount = money.get("amount") or money.get("Amount")
    if amount is not None:
        return str(int(amount))

    display = price.get("displayAmount") or price.get("DisplayAmount") or "0"
    return (
        str(display)
        .replace("￥", "")
        .replace("¥", "")
        .replace(",", "")
        .strip()
    )


def _item_to_product(item: dict) -> dict:
    item_info = item.get("itemInfo") or item.get("ItemInfo") or {}
    title_block = item_info.get("title") or item_info.get("Title") or {}
    features_block = item_info.get("features") or item_info.get("Features") or {}
    images = item.get("images") or item.get("Images") or {}
    primary = images.get("primary") or images.get("Primary") or {}
    medium = primary.get("medium") or primary.get("Medium") or {}

    features = features_block.get("displayValues") or features_block.get("DisplayValues") or []
    description = "\n".join(features) if features else "説明なし"

    return {
        "title": title_block.get("displayValue") or title_block.get("DisplayValue") or "商品名不明",
        "url": item.get("detailPageURL") or item.get("DetailPageURL") or "URLなし",
        "image": medium.get("url") or medium.get("URL") or "画像なし",
        "price": _extract_price(item),
        "description": description,
    }


def search_products_with_filters(keyword: str, filters: dict) -> str:
    if not is_creators_configured():
        return json.dumps(
            {"error": "Amazon Creators APIの認証情報がサーバーに設定されていません。"},
            ensure_ascii=False,
        )

    all_items: list[dict] = []
    max_pages = 3

    for page in range(1, max_pages + 1):
        body: dict[str, Any] = {
            "keywords": keyword,
            "partnerTag": PARTNER_TAG,
            "partnerType": "Associates",
            "searchIndex": "All",
            "itemCount": 10,
            "itemPage": page,
            "marketplace": MARKETPLACE,
            "resources": [
                "itemInfo.title",
                "itemInfo.features",
                "images.primary.medium",
                "offersV2.listings.price",
            ],
        }

        min_price = filters.get("price_from") or filters.get("minPrice")
        max_price = filters.get("price_to") or filters.get("maxPrice")
        if min_price is not None:
            body["minPrice"] = min_price
        if max_price is not None:
            body["maxPrice"] = max_price

        sort_order = filters.get("sort")
        if sort_order == "Price:HighToLow":
            body["sortBy"] = "Price:HighToLow"
        elif sort_order == "Price:LowToHigh":
            body["sortBy"] = "Price:LowToHigh"

        try:
            payload = _creators_post("searchItems", body)
        except Exception as error:
            return json.dumps({"error": str(error)}, ensure_ascii=False)

        search_result = payload.get("searchResult") or payload.get("SearchResult") or {}
        items = search_result.get("items") or search_result.get("Items") or []
        if not items:
            break

        all_items.extend(items)
        if page < max_pages:
            time.sleep(1)

    results = [_item_to_product(item) for item in all_items]
    if results:
        return json.dumps(results, ensure_ascii=False, indent=2)
    return json.dumps({"message": "商品が見つかりませんでした。"}, ensure_ascii=False)
