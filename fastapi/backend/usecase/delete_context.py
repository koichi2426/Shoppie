import logging
from dataclasses import dataclass
from typing import Protocol

from domain.entities.conversation_thread import new_conversation_thread
from domain.repositories.conversation_repository import ConversationRepository

logger = logging.getLogger("shoppie.usecase.delete_context")


@dataclass(frozen=True, slots=True)
class DeleteContextInput:
    context_id: str


@dataclass(frozen=True, slots=True)
class DeleteContextOutput:
    context_id: str
    deleted: bool


class DeleteContextPresenter(Protocol):
    def output(self, result: DeleteContextOutput) -> dict:
        ...


class DeleteContextUseCase:
    def __init__(
        self,
        conversation_repository: ConversationRepository,
        presenter: DeleteContextPresenter,
    ) -> None:
        self._conversation_repository = conversation_repository
        self._presenter = presenter

    def execute(self, input_data: DeleteContextInput) -> dict:
        thread = new_conversation_thread(input_data.context_id)
        deleted = self._conversation_repository.delete(thread.id)

        logger.info(
            "context delete context_id=%s deleted=%s",
            thread.id.value,
            deleted,
        )

        return self._presenter.output(
            DeleteContextOutput(
                context_id=thread.id.value,
                deleted=deleted,
            )
        )
