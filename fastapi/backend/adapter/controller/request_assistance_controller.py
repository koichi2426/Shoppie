from fastapi import HTTPException

from usecase.request_assistance import RequestAssistanceInput, RequestAssistanceUseCase


class RequestAssistanceController:
    """HTTP リクエストを受け取り、ユースケースの Input DTO に変換して実行する。"""

    def __init__(self, usecase: RequestAssistanceUseCase) -> None:
        self._usecase = usecase

    async def handle(self, text: str, context_id: str) -> dict:
        input_data = RequestAssistanceInput(text=text, context_id=context_id)

        try:
            return await self._usecase.execute(input_data)
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from None
        except RuntimeError:
            raise HTTPException(
                status_code=500,
                detail="Failed to process request assistance",
            ) from None
