from fastapi import HTTPException

from usecase.delete_context import DeleteContextInput, DeleteContextUseCase


class DeleteContextController:
    """パスパラメータを受け取り、ユースケースの Input DTO に変換して実行する。"""

    def __init__(self, usecase: DeleteContextUseCase) -> None:
        self._usecase = usecase

    def delete(self, context_id: str) -> dict:
        input_data = DeleteContextInput(context_id=context_id)

        try:
            return self._usecase.execute(input_data)
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from None
