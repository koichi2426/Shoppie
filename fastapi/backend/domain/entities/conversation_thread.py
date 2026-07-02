from dataclasses import dataclass

from domain.value_objects.context_id import ContextId, new_context_id


@dataclass
class ConversationThread:
    """会話スレッド。ContextId で同一性を保つ。"""

    id: ContextId


def new_conversation_thread(context_id: object) -> ConversationThread:
    return ConversationThread(id=new_context_id(context_id))
