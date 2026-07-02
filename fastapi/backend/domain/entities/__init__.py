"""永続化されるドメインオブジェクトと、そのリポジトリ。"""

from domain.entities.conversation_thread import (
    ConversationRepository,
    ConversationThread,
    new_conversation_thread,
)

__all__ = [
    "ConversationRepository",
    "ConversationThread",
    "new_conversation_thread",
]
