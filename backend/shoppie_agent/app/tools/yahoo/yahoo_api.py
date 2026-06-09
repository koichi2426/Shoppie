import os
import requests
import json
import urllib.parse
from dotenv import load_dotenv

# 🔄 .env を読み込む
load_dotenv(override=True)

APP_ID = os.getenv("YAHOO_APP_ID")
AFFILIATE_ID = os.getenv("YAHOO_AFFILIATE_ID")
VC_SID = os.getenv("VC_SID")
VC_PID = os.getenv("VC_PID")

def base_params():
    params = {
        "appid": APP_ID,
        "results": 50,
        "in_stock": "true",
        "image_size": 600
    }
    if AFFILIATE_ID:
        params["affiliate_type"] = "vc"
        params["affiliate_id"] = AFFILIATE_ID
    return params

def search_products_with_filters(keyword: str, filters: dict) -> str:
    url = "https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch"
    params = base_params()
    params.update({"query": keyword})
    params.update(filters)

    response = requests.get(url, params=params)
    if response.status_code == 200:
        items = response.json().get("hits", [])
        results = []
        for item in items:
            original_url = item.get("url", "")
            if VC_SID and VC_PID and original_url:
                encoded_url = urllib.parse.quote_plus(original_url)
                affiliate_url = f"https://ck.jp.ap.valuecommerce.com/servlet/referral?sid={VC_SID}&pid={VC_PID}&vc_url={encoded_url}"
            else:
                affiliate_url = original_url or "URLなし"

            results.append({
                "title": item.get("name", "商品名不明"),
                "url": affiliate_url,
                "image": item.get("exImage", {}).get("url", "画像なし"),
                "price": str(item.get("price", "不明")),
                "description": item.get("description", "説明なし")
            })
        return json.dumps(results, ensure_ascii=False, indent=2) if results else json.dumps({"message": "商品が見つかりませんでした。"}, ensure_ascii=False)
    return json.dumps({"error": "商品検索に失敗しました。"}, ensure_ascii=False)
