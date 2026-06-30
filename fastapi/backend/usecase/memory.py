import logging

from infrastructure.gateways.langgraph.langgraph_agent import get_memory_state

logger = logging.getLogger("shoppie.usecase.memory")


class MemoryUseCase:
    def execute(self, thread_id: str) -> dict | None:
        logger.info("memory request thread_id=%s", thread_id)
        checkpoint = get_memory_state(thread_id)
        if not checkpoint or not hasattr(checkpoint, "state"):
            logger.info("memory not found thread_id=%s", thread_id)
            return None

        state_data = {
            key: [str(message) for message in value] if isinstance(value, list) else str(value)
            for key, value in checkpoint.state.items()
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
