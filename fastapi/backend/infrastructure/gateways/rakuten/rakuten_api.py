import json
import logging
import os
from typing import Any
from urllib.parse import urlencode

import requests

from infrastructure.marketplace_config import is_rakuten_configured

logger = logging.getLogger("shoppie.rakuten")

# 公式: https://webservice.rakuten.co.jp/documentation/ichiba-item-search
SEARCH_ENDPOINT = (
    "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401"
)
# 公式: https://webservice.rakuten.co.jp/documentation/ichiba-item-ranking
RANKING_ENDPOINT = (
    "https://openapi.rakuten.co.jp/ichibaranking/api/IchibaItem/Ranking/20220601"
)

APP_ID = os.getenv("RAKUTEN_APP_ID")
ACCESS_KEY = os.getenv("RAKUTEN_ACCESS_KEY")
AFFILIATE_ID = os.getenv("RAKUTEN_AFFILIATE_ID")
# 楽天アプリ登録の「許可されたWebサイト」と一致するURL（末尾スラッシュ推奨）
HTTP_REFERER = os.getenv("RAKUTEN_HTTP_REFERER", "https://shoppie-agent.com/")


def _referer_origin() -> tuple[str, str]:
    referer = HTTP_REFERER.strip()
    if not referer:
        referer = "https://shoppie-agent.com/"
    if not referer.endswith("/"):
        referer += "/"
    origin = referer.rstrip("/")
    return referer, origin


def _normalize_filters(filters: dict) -> dict[str, Any]:
    """LLM/旧コードのパラメータ名を公式API名に合わせる。"""
    params = dict(filters)
    if "postageFree" in params:
        params["postageFlag"] = params.pop("postageFree")
    return params


def _request(endpoint: str, params: dict[str, Any]) -> requests.Response:
    referer, origin = _referer_origin()
    query = {
        "applicationId": APP_ID,
        "accessKey": ACCESS_KEY,
        "format": "json",
        "formatVersion": 2,
        "httpReferer": referer,
        **params,
    }
    if AFFILIATE_ID:
        query["affiliateId"] = AFFILIATE_ID

    headers = {
        "accessKey": ACCESS_KEY,
        "Origin": origin,
        "Referer": referer,
    }
    url = f"{endpoint}?{urlencode(query)}"
    return requests.get(url, headers=headers, timeout=15)


def _parse_error(response: requests.Response) -> str:
    try:
        body = response.json()
        if isinstance(body, dict):
            errors = body.get("errors")
            if isinstance(errors, dict) and errors.get("errorMessage"):
                return str(errors["errorMessage"])
            if body.get("error_description"):
                return str(body["error_description"])
    except json.JSONDecodeError:
        pass
    return f"楽天APIエラー (HTTP {response.status_code})"


def _image_url_from_entry(entry: Any) -> str:
    if isinstance(entry, str):
        return entry.replace("_ex=128x128", "_ex=250x250")
    if isinstance(entry, dict):
        return str(entry.get("imageUrl", "")).replace("_ex=128x128", "_ex=250x250")
    return ""


def _normalize_image_list(value: Any) -> list:
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        return [value]
    if isinstance(value, str) and value:
        return [value]
    return []


def _parse_price(value: Any) -> str:
    if value is None:
        return "0"
    if isinstance(value, (int, float)):
        return str(int(value))
    digits = "".join(char for char in str(value) if char.isdigit())
    return digits or "0"


def _extract_item_data(entry: Any) -> dict | None:
    if not isinstance(entry, dict):
        return None
    nested = entry.get("Item") or entry.get("item")
    if isinstance(nested, dict):
        return nested
    if "itemName" in entry or "itemCode" in entry:
        return entry
    return None


def _item_to_product(data: dict) -> dict:
    image_urls = _normalize_image_list(
        data.get("mediumImageUrls") or data.get("smallImageUrls")
    )
    image = _image_url_from_entry(image_urls[0]) if image_urls else ""

    url = data.get("affiliateUrl") or data.get("itemUrl", "URLなし")

    return {
        "title": data.get("itemName", "商品名不明"),
        "url": url,
        "image": image or "画像なし",
        "price": _parse_price(data.get("itemPrice", 0)),
        "description": data.get("itemCaption") or "説明なし",
        "review_rate": data.get("reviewAverage"),
        "review_count": data.get("reviewCount"),
        "marketplace": "rakuten",
    }


def _items_from_response(response: requests.Response) -> list[dict]:
    try:
        payload = response.json()
    except json.JSONDecodeError:
        logger.warning("rakuten response is not valid json body=%s", response.text[:300])
        return []

    if not isinstance(payload, dict):
        logger.warning("rakuten response payload is not object type=%s", type(payload).__name__)
        return []

    if payload.get("error") or payload.get("errors"):
        return []

    raw_items = payload.get("Items") or payload.get("items") or []
    if isinstance(raw_items, dict):
        raw_items = list(raw_items.values())
    if not isinstance(raw_items, list):
        return []

    results = []
    for entry in raw_items:
        try:
            data = _extract_item_data(entry)
            if data is None:
                continue
            results.append(_item_to_product(data))
        except Exception as error:
            logger.warning("rakuten item parse skipped error=%s entry=%r", error, entry)
    return results


def search_products_with_filters(keyword: str, filters: dict) -> str:
    """
    楽天市場 商品検索API (IchibaItem/Search/20260401)
    公式: https://webservice.rakuten.co.jp/documentation/ichiba-item-search
    """
    if not is_rakuten_configured():
        return json.dumps(
            {"error": "楽天APIの認証情報がサーバーに設定されていません。"},
            ensure_ascii=False,
        )

    params = _normalize_filters(filters)
    params.setdefault("keyword", keyword)
    params.setdefault("hits", 20)
    params.setdefault("availability", 1)

    logger.info("rakuten search start keyword=%r filters=%s", keyword, params)
    response = _request(SEARCH_ENDPOINT, params)

    if response.status_code == 200:
        try:
            results = _items_from_response(response)
        except Exception as error:
            logger.exception("rakuten search parse failed keyword=%r error=%s", keyword, error)
            return json.dumps({"error": str(error)}, ensure_ascii=False)
        logger.info("rakuten search done keyword=%r products=%s", keyword, len(results))
        if results:
            return json.dumps(results, ensure_ascii=False, indent=2)
        return json.dumps(
            {"message": "商品が見つかりませんでした。"},
            ensure_ascii=False,
        )

    logger.warning(
        "rakuten search failed status=%s body=%s",
        response.status_code,
        response.text[:300],
    )
    return json.dumps({"error": _parse_error(response)}, ensure_ascii=False)


def get_genre_id_from_keyword(keyword: str) -> str | None:
    response = _request(SEARCH_ENDPOINT, {"keyword": keyword, "hits": 1})
    if response.status_code != 200:
        return None

    payload = response.json()
    items = payload.get("Items") or payload.get("items") or []
    if not items:
        return None

    first = items[0]
    data = _extract_item_data(first)
    return data.get("genreId") if data else None


def keyword_to_ranking_products(keyword: str) -> str:
    """
    楽天市場 ランキングAPI (IchibaItem/Ranking/20220601)
    公式: https://webservice.rakuten.co.jp/documentation/ichiba-item-ranking
    """
    if not is_rakuten_configured():
        return json.dumps(
            {"error": "楽天APIの認証情報がサーバーに設定されていません。"},
            ensure_ascii=False,
        )

    genre_id = get_genre_id_from_keyword(keyword)
    if not genre_id:
        return json.dumps(
            {"message": "該当ジャンルが見つかりませんでした。"},
            ensure_ascii=False,
        )

    response = _request(RANKING_ENDPOINT, {"genreId": genre_id})
    if response.status_code == 200:
        results = _items_from_response(response)[:20]
        if results:
            return json.dumps(results, ensure_ascii=False, indent=2)
        return json.dumps(
            {"message": "ランキング商品が見つかりませんでした。"},
            ensure_ascii=False,
        )

    return json.dumps({"error": _parse_error(response)}, ensure_ascii=False)
