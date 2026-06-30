from fastapi import HTTPException

from adapter.presenter.request_assistance_presenter import RequestAssistancePresenter
from domain.entities.user_utterance import UserUtterance
from usecase.request_assistance import RequestAssistanceUseCase


class RequestAssistanceController:
    def __init__(self) -> None:
        self.usecase = RequestAssistanceUseCase()
        self.presenter = RequestAssistancePresenter()

    async def handle(self, body: dict) -> dict:
        text = body.get("text", "")
        context_id = body.get("context_id", "")
        if not text or not context_id:
            raise HTTPException(
                status_code=400,
                detail="Missing required fields: text, context_id",
            )

        try:
            response = await self.usecase.execute(
                UserUtterance(text=text, context_id=context_id)
            )
        except RuntimeError:
            raise HTTPException(
                status_code=500,
                detail="Failed to process request assistance",
            ) from None

        return self.presenter.output(response)
