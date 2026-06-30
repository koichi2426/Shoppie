import logging
import time

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.admin_auth import require_admin_key
from app.log_util import setup_logging, truncate
from app.langgraph_agent import (
    count_products,
    run_agent,
    get_memory_state,
    serialize_memory_messages,
    list_memory_thread_ids,
    delete_thread_memory,
    delete_all_thread_memories,
)
from app.session_store import (
    extract_assistant_message,
    extract_products_preview,
    session_store,
)

setup_logging()
logger = logging.getLogger("shoppie.api")

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


class ChatRequest(BaseModel):
    user_input: str
    thread_id: str = "default"


@app.post("/chat")
async def chat(request: Request):
    body = await request.json()
    user_input = body.get("message", "")
    thread_id = body.get("thread_id", "default")

    logger.info(
        "chat request thread_id=%s message=%r",
        thread_id,
        truncate(user_input),
    )

    start = time.perf_counter()
    response = await run_agent(user_input, thread_id=thread_id)
    duration_ms = (time.perf_counter() - start) * 1000
    product_count = count_products(response.get("parsed_tool_content"))
    has_error = "error" in response

    if not has_error:
        session_store.record_turn(
            thread_id=thread_id,
            user_message=user_input,
            assistant_message=extract_assistant_message(response),
            product_count=product_count,
            products_preview=extract_products_preview(response),
        )

    logger.info(
        "chat response thread_id=%s duration_ms=%.0f products=%s events=%s error=%s",
        thread_id,
        duration_ms,
        product_count,
        len(response.get("complete_raw_events", [])),
        has_error,
    )

    if has_error:
        logger.error(
            "chat failed thread_id=%s error=%s",
            thread_id,
            response.get("error"),
        )

    return {"response": response}


@app.get("/memory/{thread_id}")
async def memory(thread_id: str):
    logger.info("memory request thread_id=%s", thread_id)
    checkpoint = get_memory_state(thread_id)

    if not checkpoint or not hasattr(checkpoint, "state"):
        logger.info("memory not found thread_id=%s", thread_id)
        return {"message": f"No memory found for thread_id: {thread_id}"}

    state_data = {
        k: [str(msg) for msg in v] if isinstance(v, list) else str(v)
        for k, v in checkpoint.state.items()
    }

    logger.info(
        "memory response thread_id=%s keys=%s",
        thread_id,
        list(checkpoint.state.keys()),
    )

    return {
        "thread_id": thread_id,
        "keys": list(checkpoint.state.keys()),
        "state": state_data,
    }


def build_session_summaries() -> list[dict]:
    summaries = {
        summary["thread_id"]: summary
        for summary in session_store.list_sessions()
    }

    for thread_id in list_memory_thread_ids():
        if thread_id in summaries:
            continue
        summaries[thread_id] = {
            "thread_id": thread_id,
            "created_at": "",
            "last_active_at": "",
            "turn_count": 0,
            "last_user_message": "（LangGraphメモリのみ）",
            "memory_only": True,
        }

    return sorted(
        summaries.values(),
        key=lambda session: session.get("last_active_at") or "",
        reverse=True,
    )


@app.get("/admin/sessions")
async def admin_list_sessions(_: None = Depends(require_admin_key)):
    sessions = build_session_summaries()
    logger.info("admin list sessions count=%s", len(sessions))
    return {"sessions": sessions}


@app.delete("/admin/sessions")
async def admin_delete_all_sessions(_: None = Depends(require_admin_key)):
    deleted_sessions = session_store.delete_all_sessions()
    deleted_memories = delete_all_thread_memories()
    logger.info(
        "admin delete all sessions deleted_sessions=%s deleted_memories=%s",
        deleted_sessions,
        deleted_memories,
    )
    return {
        "deleted_sessions": deleted_sessions,
        "deleted_memories": deleted_memories,
    }


@app.get("/admin/sessions/{thread_id}")
async def admin_get_session(thread_id: str, _: None = Depends(require_admin_key)):
    session = session_store.get_session(thread_id)
    checkpoint = get_memory_state(thread_id)
    memory_messages = serialize_memory_messages(checkpoint)

    if session is None and not memory_messages:
        raise HTTPException(status_code=404, detail="Session not found")

    if session is None:
        logger.info(
            "admin get memory-only session thread_id=%s memory_messages=%s",
            thread_id,
            len(memory_messages),
        )
        return {
            "thread_id": thread_id,
            "created_at": "",
            "last_active_at": "",
            "turn_count": 0,
            "last_user_message": "（LangGraphメモリのみ）",
            "memory_only": True,
            "turns": [],
            "memory_messages": memory_messages,
        }

    logger.info(
        "admin get session thread_id=%s turns=%s memory_messages=%s",
        thread_id,
        len(session.turns),
        len(memory_messages),
    )

    return {
        **session.to_detail(),
        "memory_messages": memory_messages,
    }


@app.delete("/admin/sessions/{thread_id}")
async def admin_delete_session(thread_id: str, _: None = Depends(require_admin_key)):
    deleted_session = session_store.delete_session(thread_id)
    deleted_memory = delete_thread_memory(thread_id)

    if not deleted_session and not deleted_memory:
        raise HTTPException(status_code=404, detail="Session not found")

    logger.info(
        "admin delete session thread_id=%s deleted_session=%s deleted_memory=%s",
        thread_id,
        deleted_session,
        deleted_memory,
    )

    return {
        "thread_id": thread_id,
        "deleted_session": deleted_session,
        "deleted_memory": deleted_memory,
    }
