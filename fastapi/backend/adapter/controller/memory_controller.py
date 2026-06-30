from adapter.presenter.memory_presenter import MemoryPresenter
from usecase.memory import MemoryUseCase


class MemoryController:
    def __init__(self) -> None:
        self.usecase = MemoryUseCase()
        self.presenter = MemoryPresenter()

    def handle(self, thread_id: str) -> dict:
        result = self.usecase.execute(thread_id)
        if result is None:
            return self.presenter.not_found(thread_id)
        return self.presenter.output(
            thread_id=result["thread_id"],
            keys=result["keys"],
            state_data=result["state"],
        )
