from __future__ import annotations

import json
import logging
import os
import sqlite3
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any

from infrastructure.log_util import normalize_messages

logger = logging.getLogger("shoppie.session_store")

DEFAULT_DB_PATH = Path(__file__).resolve().parents[1] / "data" / "sessions.db"


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

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> SessionTurn:
        return cls(
            timestamp=data["timestamp"],
            user_message=data["user_message"],
            assistant_message=data["assistant_message"],
            product_count=int(data["product_count"]),
            products_preview=data.get("products_preview") or [],
        )


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
    def __init__(self, db_path: Path | None = None) -> None:
        configured = os.getenv("SESSION_STORE_PATH")
        self._db_path = Path(configured) if configured else (db_path or DEFAULT_DB_PATH)
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()
        self._init_db()
        logger.info("session store ready path=%s", self._db_path)

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path, timeout=30, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS sessions (
                    thread_id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    last_active_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS session_turns (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    thread_id TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    user_message TEXT NOT NULL,
                    assistant_message TEXT NOT NULL,
                    product_count INTEGER NOT NULL,
                    products_preview TEXT NOT NULL,
                    FOREIGN KEY(thread_id) REFERENCES sessions(thread_id)
                );

                CREATE INDEX IF NOT EXISTS idx_session_turns_thread_id
                    ON session_turns(thread_id, id);
                """
            )
            conn.commit()

    def record_turn(
        self,
        thread_id: str,
        user_message: str,
        assistant_message: str,
        product_count: int,
        products_preview: list[dict[str, Any]] | None = None,
    ) -> None:
        now = _now_iso()
        preview_json = json.dumps(products_preview or [], ensure_ascii=False)

        with self._lock:
            with self._connect() as conn:
                existing = conn.execute(
                    "SELECT thread_id FROM sessions WHERE thread_id = ?",
                    (thread_id,),
                ).fetchone()

                if existing is None:
                    conn.execute(
                        """
                        INSERT INTO sessions (thread_id, created_at, last_active_at)
                        VALUES (?, ?, ?)
                        """,
                        (thread_id, now, now),
                    )
                else:
                    conn.execute(
                        """
                        UPDATE sessions SET last_active_at = ?
                        WHERE thread_id = ?
                        """,
                        (now, thread_id),
                    )

                conn.execute(
                    """
                    INSERT INTO session_turns (
                        thread_id, timestamp, user_message, assistant_message,
                        product_count, products_preview
                    ) VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        thread_id,
                        now,
                        user_message,
                        assistant_message,
                        product_count,
                        preview_json,
                    ),
                )
                conn.commit()

                turn_count = conn.execute(
                    "SELECT COUNT(*) AS count FROM session_turns WHERE thread_id = ?",
                    (thread_id,),
                ).fetchone()["count"]

        logger.info(
            "session turn recorded thread_id=%s turn_count=%s user_message=%r",
            thread_id,
            turn_count,
            user_message[:80],
        )

    def list_sessions(self) -> list[dict[str, Any]]:
        with self._lock:
            with self._connect() as conn:
                rows = conn.execute(
                    """
                    SELECT thread_id, created_at, last_active_at
                    FROM sessions
                    ORDER BY last_active_at DESC
                    """
                ).fetchall()

                summaries = []
                for row in rows:
                    session = self._load_session(conn, row["thread_id"])
                    if session is not None:
                        summaries.append(session.to_summary())
                return summaries

    def get_session(self, thread_id: str) -> SessionRecord | None:
        with self._lock:
            with self._connect() as conn:
                return self._load_session(conn, thread_id)

    def delete_session(self, thread_id: str) -> bool:
        with self._lock:
            with self._connect() as conn:
                existing = conn.execute(
                    "SELECT thread_id FROM sessions WHERE thread_id = ?",
                    (thread_id,),
                ).fetchone()
                if existing is None:
                    return False

                conn.execute(
                    "DELETE FROM session_turns WHERE thread_id = ?",
                    (thread_id,),
                )
                conn.execute(
                    "DELETE FROM sessions WHERE thread_id = ?",
                    (thread_id,),
                )
                conn.commit()
                return True

    def delete_all_sessions(self) -> int:
        with self._lock:
            with self._connect() as conn:
                count = conn.execute("SELECT COUNT(*) AS count FROM sessions").fetchone()["count"]
                conn.execute("DELETE FROM session_turns")
                conn.execute("DELETE FROM sessions")
                conn.commit()
                return int(count)

    def list_thread_ids(self) -> list[str]:
        with self._lock:
            with self._connect() as conn:
                rows = conn.execute("SELECT thread_id FROM sessions").fetchall()
                return [row["thread_id"] for row in rows]

    def _load_session(self, conn: sqlite3.Connection, thread_id: str) -> SessionRecord | None:
        row = conn.execute(
            "SELECT thread_id, created_at, last_active_at FROM sessions WHERE thread_id = ?",
            (thread_id,),
        ).fetchone()
        if row is None:
            return None

        turn_rows = conn.execute(
            """
            SELECT timestamp, user_message, assistant_message, product_count, products_preview
            FROM session_turns
            WHERE thread_id = ?
            ORDER BY id ASC
            """,
            (thread_id,),
        ).fetchall()

        turns = []
        for turn_row in turn_rows:
            turns.append(
                SessionTurn(
                    timestamp=turn_row["timestamp"],
                    user_message=turn_row["user_message"],
                    assistant_message=turn_row["assistant_message"],
                    product_count=int(turn_row["product_count"]),
                    products_preview=json.loads(turn_row["products_preview"] or "[]"),
                )
            )

        return SessionRecord(
            thread_id=row["thread_id"],
            created_at=row["created_at"],
            last_active_at=row["last_active_at"],
            turns=turns,
        )


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
