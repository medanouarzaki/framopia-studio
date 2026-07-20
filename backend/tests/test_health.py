"""Tests for GET /health and server binding configuration."""

from fastapi.testclient import TestClient

from app.main import SERVER_HOST, app  # noqa: E402

client = TestClient(app)


def test_health_status_200() -> None:
    """GET /health returns HTTP 200."""
    response = client.get("/health")
    assert response.status_code == 200


def test_health_shape() -> None:
    """GET /health returns all required keys with correct types."""
    response = client.get("/health")
    body = response.json()

    assert body["status"] == "ok"
    assert isinstance(body["version"], str)
    assert len(body["version"]) > 0
    assert isinstance(body["ffmpeg_ok"], bool)
    assert isinstance(body["keys_ok"], bool)


def test_health_has_exactly_four_keys() -> None:
    """Response has exactly the four documented keys — no extras, no missing."""
    response = client.get("/health")
    assert set(response.json().keys()) == {"status", "version", "ffmpeg_ok", "keys_ok"}


def test_server_binds_localhost_only() -> None:
    """SERVER_HOST must be 127.0.0.1, never 0.0.0.0 (spec §21)."""
    assert SERVER_HOST == "127.0.0.1"
    assert SERVER_HOST != "0.0.0.0"
