from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ProductSchema(BaseModel):
    title: str
    price: int
    image_urls: list[str]
    affiliate_url: str
    description: str | None = None
    marketplace: str | None = None


class AgentResponseSchema(BaseModel):
    message: str
    products: list[ProductSchema]


class RequestAssistanceBody(BaseModel):
    text: str = Field(..., min_length=1)
    context_id: str = Field(..., min_length=1)


class RequestAssistanceResponse(BaseModel):
    response: AgentResponseSchema
    turn_id: str = Field(..., description="この往復の識別子。商品のクリックなどの反応に付けて送り返す")
    config_version: str = Field(..., description="返答を作ったエージェント構成の識別子")


class InteractionEventBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["product_click", "conversation_reset"]
    context_id: str = Field(..., min_length=1, max_length=128)
    turn_id: str | None = Field(default=None, max_length=64)
    rank: int | None = Field(default=None, ge=1, le=1000, description="返答の中での商品の表示順(1 始まり)")
    marketplace: str | None = Field(default=None, max_length=32)
    price_yen: int | None = Field(default=None, ge=0)


class DeleteContextResponse(BaseModel):
    context_id: str
    deleted: bool
