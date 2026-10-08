import logging
from dataclasses import dataclass

from domain.services.interaction_event_recorder import InteractionEventRecorder
from domain.value_objects.interaction_event import new_client_interaction_event

logger = logging.getLogger("shoppie.usecase.record_interaction_event")


@dataclass(frozen=True, slots=True)
class RecordInteractionEventInput:
    """ブラウザから届いた反応(プリミティブ型)。"""

    type: str
    context_id: str
    turn_id: str | None = None
    rank: int | None = None
    marketplace: str | None = None
    price_yen: int | None = None


class RecordInteractionEventUseCase:
    def __init__(self, event_recorder: InteractionEventRecorder) -> None:
        self._event_recorder = event_recorder

    def execute(self, input_data: RecordInteractionEventInput) -> None:
        event = new_client_interaction_event(
            event_type=input_data.type,
            context_id=input_data.context_id,
            turn_id=input_data.turn_id,
            rank=input_data.rank,
            marketplace=input_data.marketplace,
            price_yen=input_data.price_yen,
        )
        self._event_recorder.record(event)
