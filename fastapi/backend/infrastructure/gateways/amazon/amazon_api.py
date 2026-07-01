import os
import json
import time
import logging
from dotenv import load_dotenv

from infrastructure.marketplace_config import is_amazon_configured
from .AWSSigningV4 import AWSSigningV4

load_dotenv(override=True)

logger = logging.getLogger("shoppie.amazon")

ACCESS_KEY = os.getenv("AMAZON_ACCESS_KEY")
SECRET_KEY = os.getenv("AMAZON_SECRET_KEY")
PARTNER_TAG = os.getenv("AMAZON_PARTNER_TAG")
REGION = os.getenv("AMAZON_REGION")
HOST = "webservices.amazon.co.jp"


def search_products_with_filters(keyword: str, filters: dict) -> str:
    """
    Amazon PAAPI v5 を使用して最大30件の商品を検索し、整形されたJSON文字列を返す。
    価格フィルターと並び替えは、APIからの取得後に行う。
    """
    if not is_amazon_configured():
        return json.dumps(
            {"error": "Amazon APIの認証情報がサーバーに設定されていません。"},
            ensure_ascii=False,
        )

    all_items = []
    # 3ページ分（最大30件）のデータを取得するループ
    for page in range(1, 4):
        payload = {
            "Keywords": keyword,
            "PartnerTag": PARTNER_TAG,
            "PartnerType": "Associates",
            "ItemCount": 10,
            "SearchIndex": "All",
            "ItemPage": page, # ページ番号を指定
            "Resources": [
                "ItemInfo.Title", "Offers.Listings.Price", "Images.Primary.Medium",
                "ItemInfo.Features", "ItemInfo.TechnicalInfo"
            ]
        }
        
        print(f"\n--- Amazon APIに送信するペイロード (Page {page}) ---")
        print(json.dumps(payload, indent=2, ensure_ascii=False))
        print("-------------------------------------------\n")

        try:
            aws_auth = AWSSigningV4(ACCESS_KEY, SECRET_KEY, HOST, REGION, "ProductAdvertisingAPI", payload)
            response_text = aws_auth.request()
            response_json = json.loads(response_text)

            if "Errors" in response_json:
                error_message = response_json["Errors"][0]["Message"]
                return json.dumps({"error": f"APIエラー (Page {page}): {error_message}"}, ensure_ascii=False)
            
            items_on_page = response_json.get("SearchResult", {}).get("Items", [])
            if not items_on_page:
                break
            
            all_items.extend(items_on_page)
            
            if page < 3:
                print(f"⏳ APIのレート制限を考慮して1秒間待機します...")
                time.sleep(1)

        except Exception as e:
            return json.dumps({"error": f"リクエスト中にエラーが発生しました (Page {page}): {str(e)}"}, ensure_ascii=False)

    # 取得した全アイテムに対して、整形と後処理を行う
    results = []
    for item in all_items:
        features = item.get("ItemInfo", {}).get("Features", {}).get("DisplayValues", [])
        description = "\n".join(features) if features else "説明なし"
        
        price_display_amount = item.get("Offers", {}).get("Listings", [{}])[0].get("Price", {}).get("DisplayAmount", "不明")
        
        # ★ここから修正
        # 全角・半角の円マークとカンマをすべて削除
        cleaned_price = price_display_amount.replace("￥", "").replace("¥", "").replace(",", "")
        # ★ここまで修正

        results.append({
            "title": item.get("ItemInfo", {}).get("Title", {}).get("DisplayValue", "商品名不明"),
            "url": item.get("DetailPageURL", "URLなし"),
            "image": item.get("Images", {}).get("Primary", {}).get("Medium", {}).get("URL", "画像なし"),
            "price": cleaned_price, # ★修正した価格を結果に含める
            "description": description
        })

    # 後処理用にフィルター条件を変数に保存
    price_from = filters.get("price_from")
    price_to = filters.get("price_to")
    sort_order = filters.get("sort")

    # Python側での絞り込みと並び替え
    def get_price_as_int(item):
        # "￥", "¥", "," は既に取り除かれている
        price_str = item.get("price", "0")
        try:
            return int(price_str)
        except (ValueError, TypeError):
            return -1

    filtered_results = []
    if price_from is not None or price_to is not None:
        for item in results:
            price = get_price_as_int(item)
            if price == -1: continue
            
            within_from = (price_from is None or price >= price_from)
            within_to = (price_to is None or price <= price_to)

            if within_from and within_to:
                filtered_results.append(item)
    else:
        filtered_results = results

    if sort_order and filtered_results:
        reverse_order = (sort_order == "Price:HighToLow")
        sortable_items = [item for item in filtered_results if get_price_as_int(item) != -1]
        sorted_results = sorted(sortable_items, key=get_price_as_int, reverse=reverse_order)
    else:
        sorted_results = filtered_results

    return json.dumps(sorted_results, ensure_ascii=False, indent=2) if sorted_results else json.dumps({"message": "商品が見つかりませんでした。"}, ensure_ascii=False)