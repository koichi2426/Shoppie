from typing import Protocol

from domain.value_objects.context_id import ContextId


class ConversationRepository(Protocol):
    """ConversationThread の永続化（実装はインフラ層）。"""

    def delete(self, thread_id: ContextId) -> bool:
        """指定 ID の会話状態を削除する。"""
