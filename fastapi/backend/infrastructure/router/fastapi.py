import asyncio
import logging
import os
import platform
import socket
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool

from adapter.controller.delete_context_controller import DeleteContextController
from adapter.controller.request_assistance_controller import RequestAssistanceController
from adapter.presenter.delete_context_presenter import DeleteContextPresenterImpl
from adapter.presenter.request_assistance_presenter import RequestAssistancePresenterImpl
from infrastructure.repository_impl.conversation_repository import LangGraphConversationRepository
from infrastructure.domain_impl.shopping_agent_service import LangGraphShoppingAgentService
from infrastructure.gateways.langgraph.langgraph_agent import (
    initialize_conversation_store,
    close_conversation_store,
    conversation_store,
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
        await asyncio.to_thread(initialize_conversation_store)
        executor = getattr(asyncio.get_running_loop(), "_default_executor", None)
        logger.info("api runtime instance=%s python=%s cpu_count=%s executor_threads=%s store=%s",
                    os.getenv("SHOPPIE_INSTANCE_ID", socket.gethostname()), platform.python_version(),
                    os.cpu_count(), getattr(executor, "_max_workers", "unknown"),
                    "postgres" if conversation_store.pool else "memory")
        start_thread_memory_cleanup()
        try:
            yield
        finally:
            await stop_thread_memory_cleanup()
            await asyncio.to_thread(close_conversation_store)

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
        response.headers["X-Shoppie-Instance"] = os.getenv("SHOPPIE_INSTANCE_ID", socket.gethostname())
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

    @app.get("/healthz")
    async def healthz():
        try:
            # Graph turns use asyncio's executor; health checks must remain
            # responsive even when its worker slots are all busy with external I/O.
            await run_in_threadpool(conversation_store.healthcheck)
        except Exception:
            raise HTTPException(status_code=503, detail="Store unavailable") from None
        return {"status": "ok"}

    @app.post("/request-assistance", response_model=RequestAssistanceResponse)
    async def request_assistance(body: RequestAssistanceBody):
        return await request_assistance_controller.handle(body.text, body.context_id)

    @app.delete("/context/{context_id}", response_model=DeleteContextResponse)
    async def delete_context(context_id: str):
        return await run_in_threadpool(delete_context_controller.delete, context_id)

    return app
