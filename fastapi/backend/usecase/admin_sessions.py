import logging

from infrastructure.gateways.langgraph.langgraph_agent import (
    delete_all_thread_memories,
    delete_thread_memory,
    get_memory_state,
    list_memory_thread_ids,
    serialize_memory_messages,
)
from infrastructure.session_store import session_store

logger = logging.getLogger("shoppie.usecase.admin_sessions")


class AdminSessionsUseCase:
    def list_sessions(self) -> list[dict]:
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
        sessions = sorted(
            summaries.values(),
            key=lambda session: session.get("last_active_at") or "",
            reverse=True,
        )
        logger.info("admin list sessions count=%s", len(sessions))
        return sessions

    def get_session(self, thread_id: str) -> dict | None:
        session = session_store.get_session(thread_id)
        checkpoint = get_memory_state(thread_id)
        memory_messages = serialize_memory_messages(checkpoint)

        if session is None and not memory_messages:
            return None

        if session is None:
            logger.info(
                "admin get memory-only session thread_id=%s memory_messages=%s",
                thread_id,
                len(memory_messages),
            )
            return {
                "thread_id": thread_id,
                "memory_only": True,
                "detail": None,
                "memory_messages": memory_messages,
            }

        logger.info(
            "admin get session thread_id=%s turns=%s memory_messages=%s",
            thread_id,
            len(session.turns),
            len(memory_messages),
        )
        return {
            "thread_id": thread_id,
            "memory_only": False,
            "detail": session.to_detail(),
            "memory_messages": memory_messages,
        }

    def delete_session(self, thread_id: str) -> tuple[bool, bool]:
        deleted_session = session_store.delete_session(thread_id)
        deleted_memory = delete_thread_memory(thread_id)
        logger.info(
            "admin delete session thread_id=%s deleted_session=%s deleted_memory=%s",
            thread_id,
            deleted_session,
            deleted_memory,
        )
        return deleted_session, deleted_memory

    def delete_all_sessions(self) -> tuple[int, int]:
        deleted_sessions = session_store.delete_all_sessions()
        deleted_memories = delete_all_thread_memories()
        logger.info(
            "admin delete all sessions deleted_sessions=%s deleted_memories=%s",
            deleted_sessions,
            deleted_memories,
        )
        return deleted_sessions, deleted_memories
