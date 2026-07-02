from dataclasses import dataclass
from typing import Protocol

from domain.value_objects.context_id import ContextId, new_context_id


@dataclass
class ConversationThread:
    """会話スレッド。ContextId で同一性を保つ。"""

    id: ContextId


def new_conversation_thread(context_id: object) -> ConversationThread:
    return ConversationThread(id=new_context_id(context_id))


class ConversationRepository(Protocol):
    """ConversationThread の永続化（実装はインフラ層）。"""

    def delete(self, thread_id: ContextId) -> bool:
        """指定 ID の会話状態を削除する。"""
