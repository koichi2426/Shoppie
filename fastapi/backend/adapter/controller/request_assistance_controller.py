from fastapi import HTTPException

from adapter.presenter.request_assistance_presenter import RequestAssistancePresenter
from domain.value_objects.user_utterance import new_user_utterance
from usecase.request_assistance import RequestAssistanceUseCase


class RequestAssistanceController:
    def __init__(self) -> None:
        self.usecase = RequestAssistanceUseCase()
        self.presenter = RequestAssistancePresenter()

    async def handle(self, body: dict) -> dict:
        text = body.get("text", "")
        context_id = body.get("context_id", "")

        try:
            utterance = new_user_utterance(context_id, text)
        except ValueError as error:
            raise HTTPException(
                status_code=400,
                detail=str(error),
            ) from None

        try:
            response = await self.usecase.execute(utterance)
        except RuntimeError:
            raise HTTPException(
                status_code=500,
                detail="Failed to process request assistance",
            ) from None

        return self.presenter.output(response)
