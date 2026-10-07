# router/fastapi.py が fastapi パッケージを隠すので、router/ の外に置く
import json

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

CLICK = {
    "type": "product_click",
    "context_id": "ctx-1",
    "turn_id": "5f0e0c8e-8c1e-4a8e-9b51-1d1a3b8c2f10",
    "rank": 1,
    "marketplace": "Yahoo",
    "price_yen": 1980,
}


def test_events_accepts_text_plain_body_from_send_beacon():
    response = client.post(
        "/events",
        content=json.dumps(CLICK),
        headers={"content-type": "text/plain;charset=UTF-8"},
    )
    assert response.status_code == 204


def test_events_rejects_unknown_fields_and_server_event_types():
    assert client.post("/events", content=json.dumps({**CLICK, "text": "発話"})).status_code == 422
    assert client.post("/events", content=json.dumps({**CLICK, "type": "turn_completed"})).status_code == 422


def test_events_rejects_large_body():
    assert client.post("/events", content="x" * 4096).status_code == 413
