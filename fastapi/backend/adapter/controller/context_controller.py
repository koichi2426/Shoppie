import logging

from infrastructure.gateways.langgraph.langgraph_agent import delete_thread_memory

logger = logging.getLogger("shoppie.context")


class ContextController:
    def delete(self, context_id: str) -> dict:
        deleted = delete_thread_memory(context_id)
        logger.info(
            "context delete context_id=%s deleted=%s",
            context_id,
            deleted,
        )
        return {"context_id": context_id, "deleted": deleted}
