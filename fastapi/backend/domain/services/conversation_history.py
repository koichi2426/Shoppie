from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True)
class ConversationTurn:
    context_id: str
    turn_id: str
    config_version: str
    user_text: str
    assistant_text: str
    products: list[dict]
    status: str = "completed"


class ConversationHistory(Protocol):
    def save_turn(self, turn: ConversationTurn) -> None:
        """Persist before returning the reply. Raise if storage is unavailable."""
        ...
