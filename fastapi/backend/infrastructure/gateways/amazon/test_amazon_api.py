import sys
import os

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from infrastructure.gateways.amazon.amazon_api import search_products_with_filters

def test_all_functions():
    test_keyword = "ワイヤレスイヤホン"

    # --- フィルターがある場合のテスト ---
    print("🔍 Amazon商品検索（フィルターあり）テスト")
    filters_with_conditions = {
        "price_from": 5000,
        "price_to": 20000,
        "sort": "Price:HighToLow"
    }
    result_with_filters = search_products_with_filters(test_keyword, filters_with_conditions)
    print(result_with_filters)
    print("\n" + "="*50 + "\n")

    # --- フィルターがない場合のテスト ---
    print("🔍 Amazon商品検索（フィルターなし）テスト")
    filters_none = {} # 空の辞書を渡す
    result_without_filters = search_products_with_filters(test_keyword, filters_none)
    print(result_without_filters)
    print("\n" + "="*50 + "\n")


if __name__ == "__main__":
    test_all_functions()