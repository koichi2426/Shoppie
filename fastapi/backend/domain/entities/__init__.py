"""永続化されるドメインオブジェクトと、そのリポジトリ。"""

from domain.entities.conversation_thread import ConversationThread, new_conversation_thread

__all__ = [
    "ConversationThread",
    "new_conversation_thread",
]
