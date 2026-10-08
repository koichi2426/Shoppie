import pytest

from adapter.presenter.request_assistance_presenter import RequestAssistancePresenterImpl
from domain.value_objects.shopping_agent_result import ShoppingAgentResult
from usecase.delete_context import DeleteContextInput, DeleteContextUseCase
from usecase.record_interaction_event import (
    RecordInteractionEventInput,
    RecordInteractionEventUseCase,
)
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


class FakeEventRecorder:
    def __init__(self):
        self.events = []

    def record(self, event) -> None:
        self.events.append(event)


@pytest.mark.asyncio
async def test_failed_agent_turn_preserves_input_in_history():
    class History:
        def __init__(self):
            self.turns = []

        def save_turn(self, turn):
            self.turns.append(turn)

    history = History()
    usecase = RequestAssistanceUseCase(
        FakeAgentService(ShoppingAgentResult("", None, error="failed", config_version="config-test")),
        RequestAssistancePresenterImpl(), conversation_history=history,
    )
    with pytest.raises(RuntimeError, match="failed"):
        await usecase.execute(RequestAssistanceInput("イヤホンを探して", "ctx-failed"))
    assert len(history.turns) == 1
    assert history.turns[0].user_text == "イヤホンを探して"
    assert history.turns[0].status == "failed"
    assert history.turns[0].config_version == "config-test"


@pytest.mark.asyncio
async def test_request_assistance_records_turn_and_returns_turn_id():
    recorder = FakeEventRecorder()
    usecase = RequestAssistanceUseCase(
        agent_service=FakeAgentService(
            ShoppingAgentResult(
                assistant_message="見つけたよ！",
                parsed_tool_content=[
                    {"title": "牛ヒレ肉", "price": 5000, "url": "https://example.com/a", "marketplace": "rakuten"},
                    {"title": "牛ヒレ肉 大", "price": 8000, "url": "https://example.com/b", "marketplace": "yahoo"},
                ],
                config_version="abc123",
            )
        ),
        presenter=RequestAssistancePresenterImpl(),
        event_recorder=recorder,
    )

    result = await usecase.execute(RequestAssistanceInput(text="牛ヒレ肉", context_id="ctx-1"))

    assert result["config_version"] == "abc123"
    assert len(recorder.events) == 1
    event = recorder.events[0].to_dict()
    assert event["type"] == "turn_completed"
    assert event["turn_id"] == result["turn_id"]
    assert event["product_count"] == 2
    assert event["marketplace_counts"] == {"rakuten": 1, "yahoo": 1}
    # 発話の本文は記録しない
    assert "牛ヒレ肉" not in str(event)


@pytest.mark.asyncio
async def test_request_assistance_records_failed_turn():
    recorder = FakeEventRecorder()
    usecase = RequestAssistanceUseCase(
        agent_service=FakeAgentService(
            ShoppingAgentResult(assistant_message="", parsed_tool_content=None, error="boom")
        ),
        presenter=RequestAssistancePresenterImpl(),
        event_recorder=recorder,
    )

    with pytest.raises(RuntimeError):
        await usecase.execute(RequestAssistanceInput(text="靴", context_id="ctx-1"))

    assert [event.type.value for event in recorder.events] == ["turn_failed"]


def test_record_interaction_event_usecase_records_click():
    recorder = FakeEventRecorder()
    usecase = RecordInteractionEventUseCase(recorder)

    usecase.execute(
        RecordInteractionEventInput(
            type="product_click",
            context_id="ctx-1",
            turn_id="5F0E0C8E-8C1E-4A8E-9B51-1D1A3B8C2F10",
            rank=3,
            marketplace="楽天",
            price_yen=3980,
        )
    )

    assert recorder.events[0].to_dict() == {
        "type": "product_click",
        "context_id": "ctx-1",
        "turn_id": "5f0e0c8e-8c1e-4a8e-9b51-1d1a3b8c2f10",
        "rank": 3,
        "marketplace": "rakuten",
        "price_yen": 3980,
    }


def test_record_interaction_event_usecase_rejects_server_event_types():
    usecase = RecordInteractionEventUseCase(FakeEventRecorder())

    with pytest.raises(ValueError, match="not accepted from clients"):
        usecase.execute(RecordInteractionEventInput(type="turn_completed", context_id="ctx-1"))
