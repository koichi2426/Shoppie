import pytest

from adapter.presenter.request_assistance_presenter import RequestAssistancePresenterImpl
from domain.value_objects.shopping_agent_result import ShoppingAgentResult
from usecase.delete_context import DeleteContextInput, DeleteContextUseCase
from usecase.request_assistance import RequestAssistanceInput, RequestAssistanceUseCase


class FakeAgentService:
    def __init__(self, result: ShoppingAgentResult):
        self._result = result
        self.calls: list[tuple[str, str]] = []

    async def run(self, user_text: str, thread_id: str) -> ShoppingAgentResult:
        self.calls.append((user_text, thread_id))
        return self._result


class FakeConversationRepository:
    def __init__(self, deleted: bool = True):
        self.deleted = deleted
        self.deleted_ids: list[str] = []

    def delete(self, thread_id) -> bool:
        self.deleted_ids.append(thread_id.value)
        return self.deleted


class FakeDeleteContextPresenter:
    def output(self, result):
        return {"context_id": result.context_id, "deleted": result.deleted}


@pytest.mark.asyncio
async def test_request_assistance_usecase_returns_presenter_output():
    agent_service = FakeAgentService(
        ShoppingAgentResult(
            assistant_message="見つけたよ！",
            parsed_tool_content=[
                {
                    "title": "牛ヒレ肉",
                    "price": 5000,
                    "url": "https://example.com/item",
                    "marketplace": "rakuten",
                }
            ],
        )
    )
    usecase = RequestAssistanceUseCase(
        agent_service=agent_service,
        presenter=RequestAssistancePresenterImpl(),
    )

    result = await usecase.execute(
        RequestAssistanceInput(text="牛ヒレ肉", context_id="ctx-1")
    )

    assert result["response"]["message"] == "見つけたよ！"
    assert len(result["response"]["products"]) == 1
    assert agent_service.calls == [("牛ヒレ肉", "ctx-1")]


@pytest.mark.asyncio
async def test_request_assistance_usecase_rejects_invalid_input():
    usecase = RequestAssistanceUseCase(
        agent_service=FakeAgentService(
            ShoppingAgentResult(assistant_message="", parsed_tool_content=None)
        ),
        presenter=RequestAssistancePresenterImpl(),
    )

    with pytest.raises(ValueError):
        await usecase.execute(RequestAssistanceInput(text="", context_id="ctx-1"))


def test_delete_context_usecase():
    repository = FakeConversationRepository(deleted=True)
    usecase = DeleteContextUseCase(
        conversation_repository=repository,
        presenter=FakeDeleteContextPresenter(),
    )

    result = usecase.execute(DeleteContextInput(context_id="ctx-99"))

    assert result == {"context_id": "ctx-99", "deleted": True}
    assert repository.deleted_ids == ["ctx-99"]
