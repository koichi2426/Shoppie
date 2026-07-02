from dataclasses import dataclass

from domain.value_objects.context_id import ContextId, new_context_id
from domain.value_objects.utterance_text import UtteranceText, new_utterance_text


@dataclass(frozen=True, slots=True)
class UserUtterance:
    """1リクエスト分のユーザー発話。永続化されない入力値オブジェクト。"""

    context_id: ContextId
    text: UtteranceText


def new_user_utterance(context_id: object, text: object) -> UserUtterance:
    return UserUtterance(
        context_id=new_context_id(context_id),
        text=new_utterance_text(text),
    )
