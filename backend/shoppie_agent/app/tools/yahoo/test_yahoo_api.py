from yahoo_api import search_products_with_filters

def test_all_functions():
    # テスト用のキーワード
    test_keyword = "AirPods Pro ケース"

    print("🔍 Yahoo商品検索（条件付き）テスト")
    filters = {
        "price_from": 3000,
        "price_to": 10000,
        "is_discounted": "true",
        "sort": "-score"
    }
    print(search_products_with_filters(test_keyword, filters))
    print("\n" + "="*50 + "\n")

if __name__ == "__main__":
    test_all_functions()
