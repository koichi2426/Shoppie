# app/tools/rakuten_tool_wrappers.py

from langchain_community.tools import tool
from pydantic import BaseModel, Field
from infrastructure.gateways.rakuten import rakuten_api
import json

# 🔧 dict型の複雑な検索条件に対応
class FiltersModel(BaseModel):
    minPrice: int = Field(..., description="最小価格（円）")
    maxPrice: int = Field(..., description="最大価格（円）")
    postageFree: int = Field(..., description="送料無料: 1=Yes, 0=No")
    availability: int = Field(..., description="在庫あり: 1=Yes, 0=No")
    sort: str = Field(..., description="並び順（例: -reviewCount）")

class SearchProductInput(BaseModel):
    keyword: str = Field(..., description="検索キーワード")
    filters: FiltersModel = Field(..., description="検索条件フィルター")

@tool(args_schema=SearchProductInput)
def search_products_with_filters_tool(keyword: str, filters: FiltersModel) -> dict:
    """
    楽天市場で条件付き商品検索（最大10件）を行います。
    """
    result_json = rakuten_api.search_products_with_filters(keyword, filters.dict())
    return json.loads(result_json)

@tool
def keyword_to_ranking_products_tool(keyword: str) -> dict:
    """
    キーワードから楽天ジャンルを推定し、ランキング上位10商品を取得します。
    """
    result_json = rakuten_api.keyword_to_ranking_products(keyword)
    return json.loads(result_json)
