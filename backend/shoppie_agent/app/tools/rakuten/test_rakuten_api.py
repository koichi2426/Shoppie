from rakuten_api import (
    keyword_to_ranking_products,
    search_products_with_filters  # ← 条件付き検索を追加
)

def test_all_functions():
    # テスト用のキーワード
    test_keyword = "レディースファッション"

    print("🔍 商品検索（条件付き）テスト")
    filters = {
        "minPrice": 3000,
        "maxPrice": 10000,
        "postageFree": 1,
        "availability": 1,
        "sort": "-reviewCount"
    }
    print(search_products_with_filters(test_keyword, filters))
    print("\n" + "="*50 + "\n")

    print("🏆 キーワードからランキング取得テスト")
    print(keyword_to_ranking_products(test_keyword))
    print("\n" + "="*50 + "\n")

if __name__ == "__main__":
    test_all_functions()
