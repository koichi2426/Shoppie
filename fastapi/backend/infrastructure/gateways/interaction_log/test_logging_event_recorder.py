import json
import logging

from domain.value_objects.interaction_event import new_client_interaction_event
from infrastructure.gateways.interaction_log.logging_event_recorder import (
    EVENT_LOG_PREFIX,
    LoggingInteractionEventRecorder,
)
from scripts.aggregate_interaction_events import parse_events


def test_logged_event_can_be_parsed_by_aggregator(caplog, monkeypatch):
    monkeypatch.setenv("RENDER_GIT_COMMIT", "0123456789abcdef")
    recorder = LoggingInteractionEventRecorder()
    event = new_client_interaction_event("conversation_reset", "ctx-1")

    with caplog.at_level(logging.INFO, logger="shoppie.events"):
        recorder.record(event)

    message = caplog.records[-1].getMessage()
    assert message.startswith(EVENT_LOG_PREFIX)
    payload = json.loads(message[len(EVENT_LOG_PREFIX):])
    assert payload["commit"] == "0123456"
    assert parse_events([message])[0]["type"] == "conversation_reset"
