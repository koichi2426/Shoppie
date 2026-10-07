from typing import Protocol

from domain.value_objects.interaction_event import InteractionEvent


class InteractionEventRecorder(Protocol):
    """ユーザーの反応の記録先(実装はインフラ層)。

    記録の失敗で返答を落とさないよう、実装は例外を外に出さない。
    """

    def record(self, event: InteractionEvent) -> None:
        ...
