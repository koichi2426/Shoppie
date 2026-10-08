"""ユーザーの反応を、1 行 1 イベントの JSON としてログに出す。

DB を持たない構成(ADR-0014)なので、記録先は標準出力のログにする。
集計は scripts/aggregate_interaction_events.py で、ログを書き出したファイルから行う。
"""

import json
import logging
import os
from datetime import datetime, timezone
from uuid import uuid4

from domain.value_objects.interaction_event import InteractionEvent

EVENT_LOG_PREFIX = "interaction_event "

logger = logging.getLogger("shoppie.events")


def _deployed_commit() -> str | None:
    # Render はデプロイしたコミットを環境変数で渡す。構成の識別子で拾えない変更も追えるようにする
    commit = os.getenv("RENDER_GIT_COMMIT")
    return commit[:7] if commit else None


class LoggingInteractionEventRecorder:
    def __init__(self) -> None:
        self._commit = _deployed_commit()

    def record(self, event: InteractionEvent) -> None:
        self.record_payload(self.payload(event))

    def payload(self, event: InteractionEvent) -> dict:
        payload = {
            "event_id": str(uuid4()),
            "ts": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
            **event.to_dict(),
        }
        if self._commit:
            payload["commit"] = self._commit
        return payload

    def record_payload(self, payload: dict) -> None:
        try:
            logger.info(
                "%s%s",
                EVENT_LOG_PREFIX,
                json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
            )
        except Exception:
            # 記録の失敗で返答を落とさない
            logger.error("interaction event logging failed type=%s", payload.get("type"))
