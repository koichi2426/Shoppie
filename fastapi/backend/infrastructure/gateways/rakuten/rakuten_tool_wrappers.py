import logging
from typing import Any, Optional

import requests
from langchain_community.tools import tool
from pydantic import BaseModel, Field, field_validator

from infrastructure.gateways.rakuten import rakuten_api
import json

logger = logging.getLogger("shoppie.rakuten")

# 楽天の認証情報はリクエスト URL のクエリに載る。requests の通信例外は URL を文字列に含むため、
# 例外の文字列をツール結果に入れると、LLM の入力・ログ・利用者への返答へ認証情報が流れうる。
# 通信例外は種類だけを記録し、モデルには固定の文言だけを返す。
REQUEST_FAILED_MESSAGE = "楽天の検索で通信エラーが発生しました。"
SEARCH_FAILED_MESSAGE = "楽天の検索に失敗しました。"


class RakutenFiltersModel(BaseModel):
    minPrice: Optional[int] = Field(None, description="最小価格（円）")
    maxPrice: Optional[int] = Field(None, description="最大価格（円）")
    postageFlag: Optional[int] = Field(
        None,
        description="送料込み: 1=送料込みのみ, 0=すべて",
    )
    availability: Optional[int] = Field(
        1,
        description="在庫あり: 1=Yes, 0=No",
    )
    sort: Optional[str] = Field(
        "standard",
        description="並び順（例: standard, +itemPrice, -itemPrice, -reviewCount）",
    )

    @field_validator("postageFlag", "availability")
    @classmethod
    def validate_flag(cls, value: Optional[int]) -> Optional[int]:
        if value is None:
            return value
        if value not in (0, 1):
            raise ValueError("0 または 1 を指定してください")
        return value


class RakutenSearchProductInput(BaseModel):
    keyword: str = Field(..., description="検索キーワード")
    filters: RakutenFiltersModel = Field(
        default_factory=RakutenFiltersModel,
        description="検索条件フィルター（必要な項目のみ指定）",
    )


@tool(args_schema=RakutenSearchProductInput)
def search_rakuten_products_with_filters_tool(
    keyword: str,
    filters: RakutenFiltersModel,
) -> Any:
    """
    楽天市場で条件付き商品検索（最大10件）を行います。
    """
    try:
        result_json = rakuten_api.search_products_with_filters(
            keyword,
            filters.model_dump(exclude_none=True),
        )
        return json.loads(result_json)
    except requests.RequestException as error:
        logger.warning("rakuten search request failed error_type=%s", type(error).__name__)
        return {"error": REQUEST_FAILED_MESSAGE}
    except Exception as error:
        logger.warning("rakuten search failed error_type=%s", type(error).__name__)
        return {"error": SEARCH_FAILED_MESSAGE}


@tool
def keyword_to_ranking_products_tool(keyword: str) -> dict:
    """
    キーワードから楽天ジャンルを推定し、ランキング上位10商品を取得します。
    """
    result_json = rakuten_api.keyword_to_ranking_products(keyword)
    return json.loads(result_json)
