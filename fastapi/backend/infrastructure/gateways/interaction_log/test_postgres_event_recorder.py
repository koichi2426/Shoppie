import io
import logging
import os
import time
from pathlib import Path
from uuid import uuid4

import psycopg
import pytest
from psycopg import sql
from psycopg.conninfo import make_conninfo

from domain.value_objects.interaction_event import new_client_interaction_event, new_turn_completed_event
from domain.value_objects.turn_id import new_turn_id
from infrastructure.gateways.interaction_log.postgres_event_recorder import (
    INSERT_EVENT, PostgresInteractionEventRecorder, build_event_recorder,
)
from infrastructure.gateways.interaction_log.logging_event_recorder import LoggingInteractionEventRecorder
from scripts.aggregate_interaction_events import parse_events, summarize
from scripts.export_interaction_events import export_events

MIGRATION = Path(__file__).resolve().parents[5] / "infra/supabase/migrations/202610080001_interaction_events.sql"


@pytest.fixture
def database():
    url = os.getenv("TEST_INTERACTION_DATABASE_URL")
    if not url:
        pytest.skip("Set TEST_INTERACTION_DATABASE_URL to a disposable PostgreSQL with CREATEDB")
    name = "events_test_" + uuid4().hex
    with psycopg.connect(url, autocommit=True) as admin:
        admin.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
        connection_url = make_conninfo(url, dbname=name)
        try:
            with psycopg.connect(connection_url, autocommit=True) as connection:
                connection.execute(MIGRATION.read_text())
            yield connection_url
        finally:
            admin.execute(sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(name)))


def wait_for_writes(recorder):
    deadline = time.monotonic() + 8
    while recorder._queue.unfinished_tasks and time.monotonic() < deadline:
        time.sleep(0.02)
    assert recorder._queue.unfinished_tasks == 0


def test_unconfigured_recorder_preserves_logging(monkeypatch):
    # Explicitly empty so dotenv cannot pick up a developer's live database.
    monkeypatch.setenv("INTERACTION_DATABASE_URL", "")
    assert isinstance(build_event_recorder(), LoggingInteractionEventRecorder)


def test_events_survive_recorder_restart_and_export_to_existing_metrics(database, monkeypatch):
    monkeypatch.setenv("RENDER_GIT_COMMIT", "abcdef123456")
    turn = new_turn_id(str(uuid4()))
    recorder = PostgresInteractionEventRecorder(database)
    recorder.initialize()
    recorder.record(new_turn_completed_event("ctx-test", turn, "config-test", ["yahoo"], 100))
    recorder.record(new_client_interaction_event("product_click", "ctx-test", turn.value, 1, "Yahoo", 1980))
    recorder.close()  # Drains pending writes before closing the pool.
    restarted = PostgresInteractionEventRecorder(database)
    restarted.initialize()
    restarted.record(new_client_interaction_event("conversation_reset", "ctx-test", turn.value))
    restarted.close()
    output = io.StringIO()
    assert export_events(database, output) == 3
    events = parse_events(output.getvalue().splitlines())
    assert len({event["event_id"] for event in events}) == 3
    assert all(event["commit"] == "abcdef1" for event in events)
    assert all("text" not in event for event in events)
    metrics = summarize(events)[0]
    assert metrics.turns == 1
    assert metrics.rates()["click_through_rate"] == 1
    assert metrics.rates()["reset_rate"] == 1
    with psycopg.connect(database, autocommit=True) as connection:
        connection.execute(MIGRATION.read_text())  # Rerunning migration preserves data.
        payload = events[0]
        from psycopg.types.json import Jsonb
        connection.execute(INSERT_EVENT, (payload["event_id"], payload["ts"], payload["type"],
                           payload["context_id"], payload["turn_id"], payload.get("config_version"), Jsonb(payload)))
    assert export_events(database, io.StringIO()) == 3


def test_write_failure_keeps_stdout_and_does_not_raise(database, caplog):
    recorder = PostgresInteractionEventRecorder(database)
    recorder.initialize()
    try:
        with psycopg.connect(database, autocommit=True) as connection:
            connection.execute("DROP TABLE shoppie_analytics.interaction_events")
        with caplog.at_level(logging.INFO, logger="shoppie.events"):
            recorder.record(new_client_interaction_event("conversation_reset", "ctx-test"))
            wait_for_writes(recorder)
        assert len(parse_events(caplog.text.splitlines())) == 1
        assert "write failed" in caplog.text
        assert "local-events-only" not in caplog.text
    finally:
        recorder.close()


def test_browser_role_cannot_read_or_write(database):
    role = "events_reader_" + uuid4().hex
    with psycopg.connect(database, autocommit=True) as connection:
        connection.execute(sql.SQL("CREATE ROLE {}").format(sql.Identifier(role)))
        try:
            connection.execute(sql.SQL("SET ROLE {}").format(sql.Identifier(role)))
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                connection.execute("SELECT * FROM shoppie_analytics.interaction_events")
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                connection.execute("INSERT INTO shoppie_analytics.interaction_events DEFAULT VALUES")
        finally:
            connection.execute("RESET ROLE")
            connection.execute(sql.SQL("DROP ROLE {}").format(sql.Identifier(role)))


def test_missing_migration_fails_startup_with_sanitized_message(database):
    with psycopg.connect(database, autocommit=True) as connection:
        connection.execute("DROP TABLE shoppie_analytics.interaction_events")
    recorder = PostgresInteractionEventRecorder(database)
    with pytest.raises(RuntimeError, match="apply the migration") as caught:
        recorder.initialize()
    assert "local-events-only" not in str(caught.value)


def test_full_queue_does_not_block_request(database, caplog):
    recorder = PostgresInteractionEventRecorder(database, queue_size=1)
    # Keep the writer paused to deterministically simulate saturation.
    from unittest.mock import Mock
    recorder._worker = Mock()
    try:
        with caplog.at_level(logging.INFO, logger="shoppie.events"):
            recorder.record(new_client_interaction_event("conversation_reset", "ctx-1"))
            recorder.record(new_client_interaction_event("conversation_reset", "ctx-2"))
        assert recorder._queue.qsize() == 1
        assert "queue full" in caplog.text
        assert len(parse_events(caplog.text.splitlines())) == 2
    finally:
        recorder._pool.close()


def test_beacon_endpoint_persists_event_with_app_lifecycle(database, monkeypatch):
    from fastapi.testclient import TestClient
    from infrastructure.router.fastapi import create_app

    monkeypatch.setenv("INTERACTION_DATABASE_URL", database)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with TestClient(create_app()) as client:
        response = client.post("/events", content='{"type":"conversation_reset","context_id":"ctx-api"}',
                               headers={"Content-Type": "text/plain;charset=UTF-8"})
        assert response.status_code == 204
        assert client.get("/healthz").status_code == 200
    output = io.StringIO()
    assert export_events(database, output) == 1
    assert parse_events(output.getvalue().splitlines())[0]["context_id"] == "ctx-api"
