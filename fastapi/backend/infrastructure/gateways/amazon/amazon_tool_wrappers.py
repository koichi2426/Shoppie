from langchain_community.tools import tool
from pydantic import BaseModel, Field
from infrastructure.gateways.amazon import amazon_api
import json
from typing import Optional

class AmazonFiltersModel(BaseModel):
    price_from: Optional[int] = Field(None, description="検索する商品の最低価格（円）。")
    price_to: Optional[int] = Field(None, description="検索する商品の最高価格（円）。")
    sort: Optional[str] = Field(None, description="商品の並び順。'Price:HighToLow'（高い順）または 'Price:LowToHigh'（安い順）を指定します。")

class AmazonSearchProductInput(BaseModel):
    keyword: str = Field(..., description="検索したい商品のキーワード。")
    filters: Optional[AmazonFiltersModel] = Field(None, description="価格範囲や並び順などのオプションの検索条件フィルター。")

@tool(args_schema=AmazonSearchProductInput)
def search_amazon_products_with_filters_tool(keyword: str, filters: Optional[AmazonFiltersModel] = None) -> dict:
    """
    Amazonでキーワードと、オプションのフィルター（価格、並び順）を使って商品を検索します（最大10件）。
    """
    filters_dict = filters.dict(exclude_none=True) if filters else {}
    result_json = amazon_api.search_products_with_filters(keyword, filters_dict)
    return json.loads(result_json)