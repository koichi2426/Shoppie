"""Bounded background writes to a private PostgreSQL schema; stdout remains a fallback."""

import logging
import os
from queue import Empty, Full, Queue
from threading import Event, Thread
from pathlib import Path

from dotenv import load_dotenv
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

from domain.value_objects.interaction_event import InteractionEvent
from domain.services.conversation_history import ConversationTurn
from infrastructure.gateways.interaction_log.logging_event_recorder import LoggingInteractionEventRecorder

logger = logging.getLogger("shoppie.events")

INSERT_EVENT = """
INSERT INTO shoppie_analytics.interaction_events
    (event_id, occurred_at, event_type, context_id, turn_id, config_version, payload)
VALUES (%s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (event_id) DO NOTHING
"""


class PostgresInteractionEventRecorder:
    def __init__(self, database_url: str, *, queue_size: int = 1000) -> None:
        self._log = LoggingInteractionEventRecorder()
        self._queue: Queue[dict] = Queue(maxsize=queue_size)
        self._stop = Event()
        self._worker: Thread | None = None
        self._pool = ConnectionPool(
            database_url, min_size=0, max_size=1, open=False, timeout=2,
            kwargs={"autocommit": True, "connect_timeout": 5, "prepare_threshold": None,
                    "options": "-c statement_timeout=3000"},
        )

    def initialize(self) -> None:
        try:
            self._pool.open()
            with self._pool.connection() as connection:
                connection.execute("SELECT event_id FROM shoppie_analytics.interaction_events LIMIT 0")
                connection.execute("SELECT turn_id FROM shoppie_analytics.conversation_turns LIMIT 0")
        except Exception as error:
            self._pool.close()
            # Do not include connection strings or server error details in logs.
            raise RuntimeError(
                "Interaction database initialization failed; check connection and apply the migration "
                f"({type(error).__name__})"
            ) from None
        self._worker = Thread(target=self._write_events, name="interaction-db-writer", daemon=True)
        self._worker.start()

    def save_turn(self, turn: ConversationTurn) -> None:
        try:
            with self._pool.connection() as connection:
                connection.execute("""
                    INSERT INTO shoppie_analytics.conversation_turns
                        (context_id, turn_id, config_version, user_text, assistant_text, products, status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (turn_id) DO NOTHING
                """, (turn.context_id, turn.turn_id, turn.config_version, turn.user_text,
                       turn.assistant_text, Jsonb(turn.products), turn.status))
        except Exception as error:
            # Raw conversation contents are never used as a logging fallback.
            logger.error("conversation history write failed error=%s turn_id=%s",
                         type(error).__name__, turn.turn_id)
            raise RuntimeError("Conversation history could not be saved") from None

    def record(self, event: InteractionEvent) -> None:
        payload = self._log.payload(event)
        self._log.record_payload(payload)
        if self._worker is None or self._stop.is_set():
            logger.error("interaction database writer unavailable; event retained in stdout")
            return
        try:
            self._queue.put_nowait(payload)
        except Full:
            logger.error("interaction database queue full; event retained in stdout")

    def _write_events(self) -> None:
        while not self._stop.is_set() or not self._queue.empty():
            try:
                payload = self._queue.get(timeout=0.1)
            except Empty:
                continue
            try:
                with self._pool.connection() as connection:
                    connection.execute(INSERT_EVENT, (
                        payload["event_id"], payload["ts"], payload["type"], payload["context_id"],
                        payload.get("turn_id"), payload.get("config_version"), Jsonb(payload),
                    ))
            except Exception as error:
                logger.error("interaction database write failed error=%s event_id=%s; retained in stdout",
                             type(error).__name__, payload["event_id"])
            finally:
                self._queue.task_done()

    def close(self) -> None:
        self._stop.set()
        if self._worker:
            self._worker.join(timeout=10)
            if self._worker.is_alive():
                logger.error("interaction database shutdown timed out; pending events retained in stdout")
        self._pool.close()


def build_event_recorder():
    load_dotenv(Path(__file__).resolve().parents[5] / ".env")
    url = os.getenv("INTERACTION_DATABASE_URL", "").strip()
    return PostgresInteractionEventRecorder(url) if url else LoggingInteractionEventRecorder()
