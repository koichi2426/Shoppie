from usecase.request_assistance import RequestAssistanceOutput, RequestAssistancePresenter


class RequestAssistancePresenterImpl(RequestAssistancePresenter):
    """ユースケースの Output DTO を JSON レスポンス形式に変換する。"""

    def output(self, result: RequestAssistanceOutput) -> dict:
        return {
            "response": {
                "message": result.message,
                "products": result.products,
            },
            "turn_id": result.turn_id,
            "config_version": result.config_version,
        }
