from pydantic import BaseModel, Field


class ProductSchema(BaseModel):
    title: str
    price: int
    image_urls: list[str]
    affiliate_url: str
    description: str | None = None


class AgentResponseSchema(BaseModel):
    message: str
    products: list[ProductSchema]


class RequestAssistanceBody(BaseModel):
    text: str = Field(..., min_length=1)
    context_id: str = Field(..., min_length=1)


class RequestAssistanceResponse(BaseModel):
    response: AgentResponseSchema


class DeleteContextResponse(BaseModel):
    context_id: str
    deleted: bool
