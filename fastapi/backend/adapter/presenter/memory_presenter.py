class MemoryPresenter:
    @staticmethod
    def not_found(thread_id: str) -> dict:
        return {"message": f"No memory found for thread_id: {thread_id}"}

    @staticmethod
    def output(thread_id: str, keys: list[str], state_data: dict) -> dict:
        return {
            "thread_id": thread_id,
            "keys": keys,
            "state": state_data,
        }
