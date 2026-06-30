class AdminSessionsPresenter:
    @staticmethod
    def list_output(sessions: list[dict]) -> dict:
        return {"sessions": sessions}

    @staticmethod
    def delete_all_output(deleted_sessions: int, deleted_memories: int) -> dict:
        return {
            "deleted_sessions": deleted_sessions,
            "deleted_memories": deleted_memories,
        }

    @staticmethod
    def delete_output(thread_id: str, deleted_session: bool, deleted_memory: bool) -> dict:
        return {
            "thread_id": thread_id,
            "deleted_session": deleted_session,
            "deleted_memory": deleted_memory,
        }

    @staticmethod
    def memory_only_session(thread_id: str, memory_messages: list[dict]) -> dict:
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
