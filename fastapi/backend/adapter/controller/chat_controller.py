from fastapi import Request

from adapter.presenter.chat_presenter import ChatPresenter
from usecase.chat import ChatUseCase


class ChatController:
    def __init__(self) -> None:
        self.usecase = ChatUseCase()
        self.presenter = ChatPresenter()

    async def handle(self, request: Request) -> dict:
        body = await request.json()
        user_input = body.get("message", "")
        thread_id = body.get("thread_id", "default")
        response = await self.usecase.execute(user_input, thread_id)
        return self.presenter.output(response)
