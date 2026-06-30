from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from threading import Lock
from typing import Any

from infrastructure.log_util import normalize_messages


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class SessionTurn:
    timestamp: str
    user_message: str
    assistant_message: str
    product_count: int
    products_preview: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "timestamp": self.timestamp,
            "user_message": self.user_message,
            "assistant_message": self.assistant_message,
            "product_count": self.product_count,
            "products_preview": self.products_preview,
        }


@dataclass
class SessionRecord:
    thread_id: str
    created_at: str
    last_active_at: str
    turns: list[SessionTurn] = field(default_factory=list)

    def to_summary(self) -> dict[str, Any]:
        last_turn = self.turns[-1] if self.turns else None
        return {
            "thread_id": self.thread_id,
            "created_at": self.created_at,
            "last_active_at": self.last_active_at,
            "turn_count": len(self.turns),
            "last_user_message": last_turn.user_message if last_turn else "",
        }

    def to_detail(self) -> dict[str, Any]:
        return {
            **self.to_summary(),
            "turns": [turn.to_dict() for turn in self.turns],
        }


class SessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, SessionRecord] = {}
        self._lock = Lock()

    def record_turn(
        self,
        thread_id: str,
        user_message: str,
        assistant_message: str,
        product_count: int,
        products_preview: list[dict[str, Any]] | None = None,
    ) -> None:
        now = _now_iso()
        turn = SessionTurn(
            timestamp=now,
            user_message=user_message,
            assistant_message=assistant_message,
            product_count=product_count,
            products_preview=products_preview or [],
        )

        with self._lock:
            session = self._sessions.get(thread_id)
            if session is None:
                session = SessionRecord(
                    thread_id=thread_id,
                    created_at=now,
                    last_active_at=now,
                )
                self._sessions[thread_id] = session

            session.turns.append(turn)
            session.last_active_at = now

    def list_sessions(self) -> list[dict[str, Any]]:
        with self._lock:
            sessions = sorted(
                self._sessions.values(),
                key=lambda session: session.last_active_at,
                reverse=True,
            )
            return [session.to_summary() for session in sessions]

    def get_session(self, thread_id: str) -> SessionRecord | None:
        with self._lock:
            return self._sessions.get(thread_id)

    def delete_session(self, thread_id: str) -> bool:
        with self._lock:
            return self._sessions.pop(thread_id, None) is not None

    def delete_all_sessions(self) -> int:
        with self._lock:
            count = len(self._sessions)
            self._sessions.clear()
            return count

    def list_thread_ids(self) -> list[str]:
        with self._lock:
            return list(self._sessions.keys())


session_store = SessionStore()


def extract_assistant_message(response: dict[str, Any]) -> str:
    for event in reversed(response.get("complete_raw_events", [])):
        if "llm_agent" not in event:
            continue
        messages = normalize_messages(event["llm_agent"].get("messages", []))
        if not messages:
            continue
        last = messages[-1]
        content = getattr(last, "content", "") or ""
        if content:
            return content
    return ""


def extract_products_preview(response: dict[str, Any], limit: int = 5) -> list[dict[str, Any]]:
    parsed = response.get("parsed_tool_content")
    if not isinstance(parsed, list):
        return []

    preview = []
    for item in parsed[:limit]:
        if not isinstance(item, dict):
            continue
        preview.append(
            {
                "title": item.get("title", ""),
                "price": item.get("price", ""),
            }
        )
    return preview
