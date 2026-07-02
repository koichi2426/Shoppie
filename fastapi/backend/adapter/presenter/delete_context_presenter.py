from usecase.delete_context import DeleteContextOutput, DeleteContextPresenter


class DeleteContextPresenterImpl(DeleteContextPresenter):
    """ユースケースの Output DTO を JSON レスポンス形式に変換する。"""

    def output(self, result: DeleteContextOutput) -> dict:
        return {
            "context_id": result.context_id,
            "deleted": result.deleted,
        }
