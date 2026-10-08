import asyncio
import logging
import os
import platform
import socket
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool

from adapter.controller.delete_context_controller import DeleteContextController
from adapter.controller.record_interaction_event_controller import RecordInteractionEventController
from adapter.controller.request_assistance_controller import RequestAssistanceController
from adapter.presenter.delete_context_presenter import DeleteContextPresenterImpl
from adapter.presenter.request_assistance_presenter import RequestAssistancePresenterImpl
from infrastructure.repository_impl.conversation_repository import LangGraphConversationRepository
from infrastructure.domain_impl.shopping_agent_service import LangGraphShoppingAgentService
from infrastructure.gateways.interaction_log.postgres_event_recorder import build_event_recorder
from infrastructure.gateways.langgraph.langgraph_agent import (
    initialize_conversation_store,
    close_conversation_store,
    conversation_store,
    start_thread_memory_cleanup,
    stop_thread_memory_cleanup,
)
from infrastructure.router.schemas import (
    DeleteContextResponse,
    InteractionEventBody,
    RequestAssistanceBody,
    RequestAssistanceResponse,
)
from usecase.delete_context import DeleteContextUseCase
from usecase.record_interaction_event import RecordInteractionEventUseCase
from usecase.request_assistance import RequestAssistanceUseCase

logger = logging.getLogger("shoppie.api")

# 反応は数個の項目しか持たない。ログを大きな本文で埋められないように上限を置く
MAX_EVENT_BODY_BYTES = 2048


def _build_controllers(event_recorder) -> tuple[
    RequestAssistanceController,
    DeleteContextController,
    RecordInteractionEventController,
]:
    agent_service = LangGraphShoppingAgentService()
    conversation_repository = LangGraphConversationRepository()

    request_assistance_usecase = RequestAssistanceUseCase(
        agent_service=agent_service,
        presenter=RequestAssistancePresenterImpl(),
        event_recorder=event_recorder,
    )
    delete_context_usecase = DeleteContextUseCase(
        conversation_repository=conversation_repository,
        presenter=DeleteContextPresenterImpl(),
    )

    return (
        RequestAssistanceController(request_assistance_usecase),
        DeleteContextController(delete_context_usecase),
        RecordInteractionEventController(RecordInteractionEventUseCase(event_recorder)),
    )


def create_app() -> FastAPI:
    event_recorder = build_event_recorder()
    (
        request_assistance_controller,
        delete_context_controller,
        record_interaction_event_controller,
    ) = _build_controllers(event_recorder)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        await asyncio.to_thread(initialize_conversation_store)
        try:
            if hasattr(event_recorder, "initialize"):
                await asyncio.to_thread(event_recorder.initialize)
        except Exception:
            await asyncio.to_thread(close_conversation_store)
            raise
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
            if hasattr(event_recorder, "close"):
                await asyncio.to_thread(event_recorder.close)
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

    event_body_schema = InteractionEventBody.model_json_schema()

    # 商品カードを押すと別タブでモールに移るので、ブラウザは sendBeacon で送る。
    # sendBeacon は text/plain だとプリフライトなしで送れるため、Content-Type に関わらず本文を JSON として読む
    @app.post(
        "/events",
        status_code=204,
        response_class=Response,
        openapi_extra={
            "requestBody": {
                "required": True,
                "content": {
                    "application/json": {"schema": event_body_schema},
                    "text/plain": {"schema": event_body_schema},
                },
            }
        },
    )
    async def record_interaction_event(request: Request):
        declared_length = request.headers.get("content-length")
        if declared_length and declared_length.isdigit() and int(declared_length) > MAX_EVENT_BODY_BYTES:
            raise HTTPException(status_code=413, detail="event body is too large")
        raw = await request.body()
        if len(raw) > MAX_EVENT_BODY_BYTES:
            raise HTTPException(status_code=413, detail="event body is too large")
        try:
            body = InteractionEventBody.model_validate_json(raw)
        except ValidationError:
            raise HTTPException(status_code=422, detail="invalid event body") from None

        record_interaction_event_controller.record(
            event_type=body.type,
            context_id=body.context_id,
            turn_id=body.turn_id,
            rank=body.rank,
            marketplace=body.marketplace,
            price_yen=body.price_yen,
        )
        return Response(status_code=204)

    return app
