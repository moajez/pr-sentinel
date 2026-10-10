import json

import pytest
from fastapi.testclient import TestClient

from app.api.v1 import webhooks
from app.config import Settings
from app.core.security import compute_signature
from app.main import app

SECRET = "s3cret"


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(webhooks, "get_settings", lambda: Settings(github_webhook_secret=SECRET))
    calls = []
    seen = set()

    class FakeRedis:
        async def set(self, key, val, nx=False, ex=None):
            if key in seen:
                return None
            seen.add(key)
            return True

        async def delete(self, key):
            seen.discard(key)

    monkeypatch.setattr(webhooks.idempotency, "get_redis", lambda: FakeRedis())
    monkeypatch.setattr(webhooks.review_pull_request, "delay", lambda payload: calls.append(payload))
    c = TestClient(app)
    c.calls = calls
    return c


def payload(action="opened", draft=False):
    return {
        "action": action,
        "pull_request": {"number": 1, "title": "t", "user": {"login": "u"},
                         "head": {"sha": "a"}, "base": {"sha": "b"}, "draft": draft},
        "repository": {"id": 1, "name": "r", "full_name": "o/r", "owner": {"login": "o"}},
        "installation": {"id": 9},
    }


def post(client, body: dict, event="pull_request", sig=None, delivery="d1"):
    raw = json.dumps(body).encode()
    headers = {"X-GitHub-Event": event,
               "X-GitHub-Delivery": delivery,
               "X-Hub-Signature-256": sig or compute_signature(SECRET, raw),
               "Content-Type": "application/json"}
    return client.post("/api/v1/webhooks/github", content=raw, headers=headers)


def test_rejects_bad_signature(client):
    assert post(client, payload(), sig="sha256=bad").status_code == 401
    assert client.calls == []


def test_ping(client):
    assert post(client, {"zen": "x"}, event="ping").json() == {"status": "pong"}


def test_opened_triggers_review(client):
    r = post(client, payload())
    assert r.json() == {"status": "accepted"}
    assert len(client.calls) == 1


def test_ignores_closed_and_draft(client):
    assert post(client, payload("closed")).json()["status"] == "ignored"
    assert post(client, payload(draft=True)).json()["status"] == "ignored"
    assert client.calls == []



def test_duplicate_delivery_dropped(client):
    assert post(client, payload(), delivery="same").json() == {"status": "accepted"}
    assert post(client, payload(), delivery="same").json() == {"status": "duplicate"}
    assert len(client.calls) == 1


def test_enqueue_failure_releases_key(client, monkeypatch):
    def boom(payload):
        raise RuntimeError("broker down")

    monkeypatch.setattr(webhooks.review_pull_request, "delay", boom)
    assert post(client, payload(), delivery="x").status_code == 503
    monkeypatch.setattr(webhooks.review_pull_request, "delay", lambda p: client.calls.append(p))
    assert post(client, payload(), delivery="x").json() == {"status": "accepted"}
