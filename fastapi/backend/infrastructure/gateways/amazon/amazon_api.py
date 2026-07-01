import json
import logging
import os
import time
from urllib.parse import quote_plus

from dotenv import load_dotenv

from infrastructure.marketplace_config import is_amazon_paapi_configured
from infrastructure.gateways.amazon import creators_api
from .AWSSigningV4 import AWSSigningV4

load_dotenv(override=True)

logger = logging.getLogger("shoppie.amazon")

ACCESS_KEY = os.getenv("AMAZON_ACCESS_KEY")
SECRET_KEY = os.getenv("AMAZON_SECRET_KEY")
PARTNER_TAG = os.getenv("AMAZON_PARTNER_TAG")
REGION = os.getenv("AMAZON_REGION")
HOST = "webservices.amazon.co.jp"

ELIGIBILITY_MARKERS = (
    "eligibility requirements",
    "AssociateNotEligible",
    "not currently meet",
)

# プロセス内で一度資格不足が判明したら、以降はAPIを叩かず検索リンクにフォールバック
_eligibility_blocked = False


def is_amazon_api_eligibility_blocked() -> bool:
    return _eligibility_blocked


def _mark_eligibility_blocked(source: str, keyword: str, error_text: str) -> None:
    global _eligibility_blocked
    if _eligibility_blocked:
        return
    _eligibility_blocked = True
    logger.warning(
        "amazon product API eligibility blocked source=%s keyword=%r error=%s; "
        "falling back to affiliate search link until process restart. "
        "Creators/PA-API requires 10+ qualified shipped sales in the last 30 days.",
        source,
        keyword,
        error_text,
    )


def _is_eligibility_error(message: str) -> bool:
    lowered = message.lower()
    return any(marker.lower() in lowered for marker in ELIGIBILITY_MARKERS)


def _search_with_paapi(keyword: str, filters: dict) -> str:
    """PA-API 5.0（廃止予定・後方互換）"""
    if not is_amazon_paapi_configured():
        return json.dumps(
            {"error": "Amazon PA-APIの認証情報がサーバーに設定されていません。"},
            ensure_ascii=False,
        )

    all_items = []
    for page in range(1, 4):
        payload = {
            "Keywords": keyword,
            "PartnerTag": PARTNER_TAG,
            "PartnerType": "Associates",
            "ItemCount": 10,
            "SearchIndex": "All",
            "ItemPage": page,
            "Resources": [
                "ItemInfo.Title",
                "Offers.Listings.Price",
                "Images.Primary.Medium",
                "ItemInfo.Features",
            ],
        }

        try:
            aws_auth = AWSSigningV4(ACCESS_KEY, SECRET_KEY, HOST, REGION, "ProductAdvertisingAPI", payload)
            response_text = aws_auth.request()
            response_json = json.loads(response_text)

            if "Errors" in response_json:
                error_message = response_json["Errors"][0]["Message"]
                return json.dumps(
                    {"error": f"APIエラー (Page {page}): {error_message}"},
                    ensure_ascii=False,
                )

            items_on_page = response_json.get("SearchResult", {}).get("Items", [])
            if not items_on_page:
                break

            all_items.extend(items_on_page)
            if page < 3:
                time.sleep(1)
        except Exception as error:
            return json.dumps(
                {"error": f"リクエスト中にエラーが発生しました (Page {page}): {error}"},
                ensure_ascii=False,
            )

    results = []
    for item in all_items:
        features = item.get("ItemInfo", {}).get("Features", {}).get("DisplayValues", [])
        description = "\n".join(features) if features else "説明なし"
        price_display_amount = (
            item.get("Offers", {}).get("Listings", [{}])[0]
            .get("Price", {})
            .get("DisplayAmount", "0")
        )
        cleaned_price = price_display_amount.replace("￥", "").replace("¥", "").replace(",", "")

        results.append({
            "title": item.get("ItemInfo", {}).get("Title", {}).get("DisplayValue", "商品名不明"),
            "url": item.get("DetailPageURL", "URLなし"),
            "image": item.get("Images", {}).get("Primary", {}).get("Medium", {}).get("URL", "画像なし"),
            "price": cleaned_price,
            "description": description,
        })

    return _apply_filters(results, filters)


def _apply_filters(results: list[dict], filters: dict) -> str:
    price_from = filters.get("price_from")
    price_to = filters.get("price_to")
    sort_order = filters.get("sort")

    def get_price_as_int(item: dict) -> int:
        price_str = item.get("price", "0")
        try:
            return int(price_str)
        except (ValueError, TypeError):
            return -1

    filtered_results = results
    if price_from is not None or price_to is not None:
        filtered_results = []
        for item in results:
            price = get_price_as_int(item)
            if price == -1:
                continue
            within_from = price_from is None or price >= price_from
            within_to = price_to is None or price <= price_to
            if within_from and within_to:
                filtered_results.append(item)

    if sort_order and filtered_results:
        reverse_order = sort_order == "Price:HighToLow"
        sortable_items = [item for item in filtered_results if get_price_as_int(item) != -1]
        sorted_results = sorted(sortable_items, key=get_price_as_int, reverse=reverse_order)
    else:
        sorted_results = filtered_results

    if sorted_results:
        return json.dumps(sorted_results, ensure_ascii=False, indent=2)
    return json.dumps({"message": "商品が見つかりませんでした。"}, ensure_ascii=False)


def _affiliate_search_fallback(keyword: str) -> str:
    """
    公式APIが資格要件で使えない場合のアソシエイト検索リンク。
    商品データAPIの代替ではないが、パートナータグ付き検索URLは Associates で公式に案内されている。
    """
    search_url = f"https://www.amazon.co.jp/s?k={quote_plus(keyword)}"
    if PARTNER_TAG:
        search_url += f"&tag={PARTNER_TAG}"

    return json.dumps(
        [
            {
                "title": f"Amazonで「{keyword}」を検索",
                "url": search_url,
                "image": "https://www.amazon.co.jp/favicon.ico",
                "price": "0",
                "description": "Amazon.co.jpの検索結果ページへ移動します。",
                "is_amazon_search_link": True,
            }
        ],
        ensure_ascii=False,
        indent=2,
    )


def search_products_with_filters(keyword: str, filters: dict) -> str:
    """
    Amazon商品検索。
    1. Creators API（公式・推奨）
    2. PA-API 5.0（後方互換）
    3. アソシエイト検索リンク（API資格なし時のフォールバック）
    """
    if _eligibility_blocked:
        if PARTNER_TAG:
            logger.info(
                "amazon product API skipped (eligibility blocked); affiliate link keyword=%r",
                keyword,
            )
            return _affiliate_search_fallback(keyword)
        return json.dumps(
            {
                "error": (
                    "Amazon商品APIの利用資格がありません。"
                    "過去30日間に適格な発送済み売上が10件以上必要です。"
                )
            },
            ensure_ascii=False,
        )

    if creators_api.is_creators_configured():
        logger.info("amazon search via Creators API keyword=%r", keyword)
        result = creators_api.search_products_with_filters(keyword, filters)
        parsed = json.loads(result)
        if not (isinstance(parsed, dict) and parsed.get("error")):
            return result
        error_text = str(parsed.get("error", ""))
        if _is_eligibility_error(error_text):
            _mark_eligibility_blocked("creators", keyword, error_text)
        else:
            logger.warning(
                "amazon Creators API error keyword=%r error=%s",
                keyword,
                error_text,
            )
            return result
    else:
        logger.info("amazon Creators API not configured; skipping")

    if is_amazon_paapi_configured():
        logger.info("amazon search via PA-API keyword=%r", keyword)
        result = _search_with_paapi(keyword, filters)
        parsed = json.loads(result)
        if not (isinstance(parsed, dict) and parsed.get("error")):
            return result
        error_text = str(parsed.get("error", ""))
        if _is_eligibility_error(error_text):
            _mark_eligibility_blocked("paapi", keyword, error_text)
        else:
            logger.warning(
                "amazon PA-API error keyword=%r error=%s",
                keyword,
                error_text,
            )
            return result
    else:
        logger.info("amazon PA-API not configured; skipping")

    if PARTNER_TAG:
        logger.warning(
            "amazon product API unavailable; using affiliate search link keyword=%r",
            keyword,
        )
        return _affiliate_search_fallback(keyword)

    return json.dumps(
        {
            "error": (
                "Amazon商品APIを利用できません。"
                "Creators API認証情報またはPA-APIキー、パートナータグを設定してください。"
            )
        },
        ensure_ascii=False,
    )
