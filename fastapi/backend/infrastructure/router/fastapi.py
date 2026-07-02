import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from adapter.controller.delete_context_controller import DeleteContextController
from adapter.controller.request_assistance_controller import RequestAssistanceController
from adapter.presenter.delete_context_presenter import DeleteContextPresenterImpl
from adapter.presenter.request_assistance_presenter import RequestAssistancePresenterImpl
from infrastructure.domain_impl.conversation_repository import LangGraphConversationRepository
from infrastructure.domain_impl.shopping_agent_service import LangGraphShoppingAgentService
from infrastructure.gateways.langgraph.langgraph_agent import (
    start_thread_memory_cleanup,
    stop_thread_memory_cleanup,
)
from infrastructure.router.schemas import (
    DeleteContextResponse,
    RequestAssistanceBody,
    RequestAssistanceResponse,
)
from usecase.delete_context import DeleteContextUseCase
from usecase.request_assistance import RequestAssistanceUseCase

logger = logging.getLogger("shoppie.api")


def _build_controllers() -> tuple[RequestAssistanceController, DeleteContextController]:
    agent_service = LangGraphShoppingAgentService()
    conversation_repository = LangGraphConversationRepository()

    request_assistance_usecase = RequestAssistanceUseCase(
        agent_service=agent_service,
        presenter=RequestAssistancePresenterImpl(),
    )
    delete_context_usecase = DeleteContextUseCase(
        conversation_repository=conversation_repository,
        presenter=DeleteContextPresenterImpl(),
    )

    return (
        RequestAssistanceController(request_assistance_usecase),
        DeleteContextController(delete_context_usecase),
    )


def create_app() -> FastAPI:
    request_assistance_controller, delete_context_controller = _build_controllers()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        start_thread_memory_cleanup()
        yield
        await stop_thread_memory_cleanup()

    app = FastAPI(lifespan=lifespan)

    origins = [
        "https://shoppie-agent.com",
        "https://www.shoppie-agent.com",
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

    @app.post("/request-assistance", response_model=RequestAssistanceResponse)
    async def request_assistance(body: RequestAssistanceBody):
        return await request_assistance_controller.handle(body.text, body.context_id)

    @app.delete("/context/{context_id}", response_model=DeleteContextResponse)
    async def delete_context(context_id: str):
        return delete_context_controller.delete(context_id)

    return app
