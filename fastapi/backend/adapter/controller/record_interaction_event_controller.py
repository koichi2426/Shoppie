from fastapi import HTTPException

from usecase.record_interaction_event import (
    RecordInteractionEventInput,
    RecordInteractionEventUseCase,
)


class RecordInteractionEventController:
    """ブラウザから届いた反応を、ユースケースの Input DTO に変換して実行する。"""

    def __init__(self, usecase: RecordInteractionEventUseCase) -> None:
        self._usecase = usecase

    def record(
        self,
        event_type: str,
        context_id: str,
        turn_id: str | None,
        rank: int | None,
        marketplace: str | None,
        price_yen: int | None,
    ) -> None:
        input_data = RecordInteractionEventInput(
            type=event_type,
            context_id=context_id,
            turn_id=turn_id,
            rank=rank,
            marketplace=marketplace,
            price_yen=price_yen,
        )
        try:
            self._usecase.execute(input_data)
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from None
