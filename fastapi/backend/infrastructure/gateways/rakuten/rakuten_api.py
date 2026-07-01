import os
import requests
import json
import logging

from infrastructure.marketplace_config import is_rakuten_configured

logger = logging.getLogger("shoppie.rakuten")

APP_ID = os.getenv("RAKUTEN_APP_ID")
AFFILIATE_ID = os.getenv("RAKUTEN_AFFILIATE_ID")

# ✅ 共通パラメータ
def base_params():
    return {
        "applicationId": APP_ID,
        "affiliateId": AFFILIATE_ID,
        "format": "json"
    }

# 🔍 条件付き商品検索（キーワード → 商品情報を10件）
def search_products_with_filters(keyword: str, filters: dict) -> str:
    if not is_rakuten_configured():
        return json.dumps(
            {"error": "楽天APIの認証情報がサーバーに設定されていません。"},
            ensure_ascii=False,
        )

    url = "https://app.rakuten.co.jp/services/api/IchibaItem/Search/20170706"
    params = base_params()
    params.update({
        "keyword": keyword,
        "hits": 10
    })
    params.update(filters)  # 🔍 追加条件を反映

    response = requests.get(url, params=params, timeout=15)
    if response.status_code == 200:
        items = response.json().get("Items", [])
        results = []
        for item in items:
            data = item["Item"]
            results.append({
                "title": data.get("itemName", "商品名不明"),
                "url": data.get("affiliateUrl", "URLなし"),
                "image": data.get("mediumImageUrls", [{}])[0].get("imageUrl", "画像なし").replace("_ex=128x128", "_ex=250x250"),
                "price": str(int(data.get('itemPrice', 0))),
                "description": data.get("itemCaption", "説明なし")
            })
        return json.dumps(results, ensure_ascii=False, indent=2) if results else json.dumps({"message": "商品が見つかりませんでした。"}, ensure_ascii=False)

    logger.warning(
        "rakuten search failed status=%s body=%s",
        response.status_code,
        response.text[:300],
    )
    return json.dumps(
        {"error": f"楽天APIエラー (HTTP {response.status_code})"},
        ensure_ascii=False,
    )

# 🔍 キーワード → 最初の商品からジャンルIDを取得
def get_genre_id_from_keyword(keyword: str) -> str:
    url = "https://app.rakuten.co.jp/services/api/IchibaItem/Search/20170706"
    params = base_params()
    params.update({
        "keyword": keyword,
        "hits": 1
    })
    response = requests.get(url, params=params)
    if response.status_code == 200:
        items = response.json().get("Items", [])
        if items:
            genre_id = items[0]["Item"].get("genreId")
            return genre_id
    return None

# 🏆 ランキング取得（キーワード → ジャンル自動判定 → 上位10商品取得）
def keyword_to_ranking_products(keyword: str) -> str:
    genre_id = get_genre_id_from_keyword(keyword)
    if not genre_id:
        return json.dumps({"message": "該当ジャンルが見つかりませんでした。"}, ensure_ascii=False)

    url = "https://app.rakuten.co.jp/services/api/IchibaItem/Ranking/20170628"
    params = base_params()
    params.update({"genreId": genre_id})
    response = requests.get(url, params=params)
    if response.status_code == 200:
        items = response.json().get("Items", [])
        results = []
        for item in items[:10]:
            data = item["Item"]
            results.append({
                "title": data.get("itemName", "商品名不明"),
                "url": data.get("affiliateUrl", "URLなし"),
                "image": data.get("mediumImageUrls", [{}])[0].get("imageUrl", "画像なし").replace("_ex=128x128", "_ex=250x250"),
                "price": str(int(data.get('itemPrice', 0))),
                "description": data.get("itemCaption", "説明なし")
            })
        return json.dumps(results, ensure_ascii=False, indent=2) if results else json.dumps({"message": "ランキング商品が見つかりませんでした。"}, ensure_ascii=False)
    return json.dumps({"error": "ランキング取得に失敗しました。"}, ensure_ascii=False)
