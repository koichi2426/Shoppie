from infrastructure.gateways.langgraph.langgraph_agent import delete_thread_memory


class ContextController:
    def delete(self, context_id: str) -> dict:
        deleted = delete_thread_memory(context_id)
        return {"context_id": context_id, "deleted": deleted}
