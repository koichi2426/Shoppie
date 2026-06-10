from typing import Optional

from langchain_community.tools import tool
from pydantic import BaseModel, Field, field_validator

from app.tools.yahoo import yahoo_api
import json


class YahooFiltersModel(BaseModel):
    price_from: Optional[int] = Field(
        None,
        description="最小価格（円）。未指定なら下限なし",
    )
    price_to: Optional[int] = Field(
        None,
        description="最大価格（円）。未指定なら上限なし",
    )
    is_discounted: Optional[bool] = Field(
        None,
        description="true: セール対象商品のみに絞り込む",
    )
    sort: Optional[str] = Field(
        "-score",
        description=(
            "並び順: -score(おすすめ順), +price(安い順), "
            "-price(高い順), -review_count(レビュー数が多い順)"
        ),
    )
    condition: Optional[str] = Field(
        None,
        description="商品状態: new(新品), used(中古)",
    )
    shipping: Optional[str] = Field(
        None,
        description="送料: free(送料無料), conditional_free(条件付き送料無料)",
    )
    start: Optional[int] = Field(
        None,
        description="検索結果の開始位置(1始まり)。51件目からは start=51",
        ge=1,
    )
    genre_category_id: Optional[int] = Field(
        None,
        description="ジャンルカテゴリID（Yahooショッピングの数値ID）",
    )
    brand_id: Optional[int] = Field(
        None,
        description="ブランドID（Yahooショッピングの数値ID）",
    )
    seller_id: Optional[str] = Field(
        None,
        description="ストアID（例: zozo）",
    )

    @field_validator("condition")
    @classmethod
    def validate_condition(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        normalized = value.lower()
        if normalized not in ("new", "used"):
            raise ValueError("condition は new または used を指定してください")
        return normalized

    @field_validator("shipping")
    @classmethod
    def validate_shipping(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if value not in ("free", "conditional_free"):
            raise ValueError("shipping は free または conditional_free を指定してください")
        return value

    @field_validator("sort")
    @classmethod
    def validate_sort(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return "-score"
        allowed = {"-score", "+price", "-price", "-review_count"}
        if value not in allowed:
            raise ValueError(f"sort は {', '.join(sorted(allowed))} のいずれかを指定してください")
        return value


class YahooSearchProductInput(BaseModel):
    keyword: str = Field(..., description="検索キーワード")
    filters: YahooFiltersModel = Field(
        default_factory=YahooFiltersModel,
        description="検索条件フィルター（必要な項目のみ指定）",
    )


@tool(args_schema=YahooSearchProductInput)
def search_yahoo_products_with_filters_tool(keyword: str, filters: YahooFiltersModel) -> dict:
    """
    Yahoo!ショッピングで条件付き商品検索（最大50件）を行います。
    価格帯・セール・新品/中古・送料無料・並び順・カテゴリ/ブランド/ストアIDで絞り込めます。
    """
    result_json = yahoo_api.search_products_with_filters(
        keyword,
        filters.model_dump(exclude_none=True),
    )
    return json.loads(result_json)
