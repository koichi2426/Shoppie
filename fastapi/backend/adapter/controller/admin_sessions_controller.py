from fastapi import HTTPException

from adapter.presenter.admin_sessions_presenter import AdminSessionsPresenter
from usecase.admin_sessions import AdminSessionsUseCase


class AdminSessionsController:
    def __init__(self) -> None:
        self.usecase = AdminSessionsUseCase()
        self.presenter = AdminSessionsPresenter()

    def list_sessions(self) -> dict:
        return self.presenter.list_output(self.usecase.list_sessions())

    def get_session(self, thread_id: str) -> dict:
        result = self.usecase.get_session(thread_id)
        if result is None:
            raise HTTPException(status_code=404, detail="Session not found")

        if result["memory_only"]:
            return self.presenter.memory_only_session(
                thread_id=result["thread_id"],
                memory_messages=result["memory_messages"],
            )

        return {
            **result["detail"],
            "memory_messages": result["memory_messages"],
        }

    def delete_session(self, thread_id: str) -> dict:
        deleted_session, deleted_memory = self.usecase.delete_session(thread_id)
        if not deleted_session and not deleted_memory:
            raise HTTPException(status_code=404, detail="Session not found")
        return self.presenter.delete_output(thread_id, deleted_session, deleted_memory)

    def delete_all_sessions(self) -> dict:
        deleted_sessions, deleted_memories = self.usecase.delete_all_sessions()
        return self.presenter.delete_all_output(deleted_sessions, deleted_memories)
