import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from adapter.controller.chat_controller import ChatController
from adapter.controller.context_controller import ContextController
from adapter.controller.request_assistance_controller import RequestAssistanceController
from infrastructure.gateways.langgraph.langgraph_agent import (
    start_thread_memory_cleanup,
    stop_thread_memory_cleanup,
)
from infrastructure.router.schemas import (
    DeleteContextResponse,
    RequestAssistanceBody,
    RequestAssistanceResponse,
)

logger = logging.getLogger("shoppie.api")

chat_controller = ChatController()
request_assistance_controller = RequestAssistanceController()
context_controller = ContextController()


def create_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        start_thread_memory_cleanup()
        yield
        await stop_thread_memory_cleanup()

    app = FastAPI(lifespan=lifespan)

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

    @app.delete("/context/{context_id}", response_model=DeleteContextResponse)
    async def delete_context(context_id: str):
        return context_controller.delete(context_id)

    return app
