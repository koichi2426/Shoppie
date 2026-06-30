import logging
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from adapter.controller.admin_sessions_controller import AdminSessionsController
from adapter.controller.chat_controller import ChatController
from adapter.controller.memory_controller import MemoryController
from adapter.controller.request_assistance_controller import RequestAssistanceController
from infrastructure.router.schemas import (
    DeleteAllSessionsResponse,
    DeleteSessionResponse,
    RequestAssistanceBody,
    RequestAssistanceResponse,
    SessionDetailSchema,
    SessionListResponse,
)

logger = logging.getLogger("shoppie.api")

chat_controller = ChatController()
request_assistance_controller = RequestAssistanceController()
memory_controller = MemoryController()
admin_sessions_controller = AdminSessionsController()


def create_app() -> FastAPI:
    app = FastAPI()

    origins = [
        "https://shoppie-agent.com",
        "http://localhost:3000",
    ]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000
        logger.info(
            "HTTP %s %s status=%s duration_ms=%.0f client=%s",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            request.client.host if request.client else "unknown",
        )
        return response

    @app.post("/chat")
    async def chat(request: Request):
        return await chat_controller.handle(request)

    @app.post("/request-assistance", response_model=RequestAssistanceResponse)
    async def request_assistance(body: RequestAssistanceBody):
        return await request_assistance_controller.handle(body.model_dump())

    @app.get("/memory/{thread_id}")
    async def memory(thread_id: str):
        return memory_controller.handle(thread_id)

    @app.get("/admin/sessions", response_model=SessionListResponse)
    async def admin_list_sessions():
        return admin_sessions_controller.list_sessions()

    @app.delete("/admin/sessions", response_model=DeleteAllSessionsResponse)
    async def admin_delete_all_sessions():
        return admin_sessions_controller.delete_all_sessions()

    @app.get("/admin/sessions/{thread_id}", response_model=SessionDetailSchema)
    async def admin_get_session(thread_id: str):
        return admin_sessions_controller.get_session(thread_id)

    @app.delete("/admin/sessions/{thread_id}", response_model=DeleteSessionResponse)
    async def admin_delete_session(thread_id: str):
        return admin_sessions_controller.delete_session(thread_id)

    return app
