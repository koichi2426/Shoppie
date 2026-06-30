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


class ProductPreviewSchema(BaseModel):
    title: str
    price: str


class SessionTurnSchema(BaseModel):
    timestamp: str
    user_message: str
    assistant_message: str
    product_count: int
    products_preview: list[ProductPreviewSchema] = Field(default_factory=list)


class MemoryMessageSchema(BaseModel):
    role: str
    content: str


class SessionSummarySchema(BaseModel):
    thread_id: str
    created_at: str
    last_active_at: str
    turn_count: int
    last_user_message: str
    memory_only: bool | None = None


class SessionDetailSchema(SessionSummarySchema):
    turns: list[SessionTurnSchema] = Field(default_factory=list)
    memory_messages: list[MemoryMessageSchema] = Field(default_factory=list)


class SessionListResponse(BaseModel):
    sessions: list[SessionSummarySchema]


class DeleteSessionResponse(BaseModel):
    thread_id: str
    deleted_session: bool
    deleted_memory: bool


class DeleteAllSessionsResponse(BaseModel):
    deleted_sessions: int
    deleted_memories: int
