"""Tests for GET /health and server binding configuration."""

import shutil

from fastapi.testclient import TestClient

from app.main import SERVER_HOST, app

client = TestClient(app)


def test_health_status_200() -> None:
    """GET /health returns HTTP 200."""
    response = client.get("/health")
    assert response.status_code == 200


def test_health_shape() -> None:
    """GET /health returns all four required keys with correct types."""
    response = client.get("/health")
    body = response.json()

    assert body["status"] == "ok"
    assert isinstance(body["version"], str) and len(body["version"]) > 0
    # ffmpeg_ok and keys_ok are now real booleans reflecting actual system state.
    assert isinstance(body["ffmpeg_ok"], bool)
    assert isinstance(body["keys_ok"], bool)


def test_health_has_exactly_four_keys() -> None:
    """Response has exactly the four documented keys — no extras, no missing."""
    response = client.get("/health")
    assert set(response.json().keys()) == {"status", "version", "ffmpeg_ok", "keys_ok"}


def test_health_ffmpeg_ok_reflects_reality() -> None:
    """ffmpeg_ok matches whether ffmpeg is actually on PATH."""
    response = client.get("/health")
    expected = shutil.which("ffmpeg") is not None
    assert response.json()["ffmpeg_ok"] == expected


def test_health_keys_ok_false_without_key() -> None:
    """keys_ok is False when no GEMINI_API_KEY is configured in the test environment."""
    import os

    from app.config import clear_settings_cache

    # Ensure no real key is present in the test environment.
    # Tests run without a .env file; if GEMINI_API_KEY happens to be in the OS env,
    # we skip this assertion (we cannot unset it from a subprocess).
    key_in_env = os.environ.get("GEMINI_API_KEY")
    if key_in_env:
        # A real key is set in the environment; keys_ok will be True — acceptable.
        response = client.get("/health")
        assert response.json()["keys_ok"] is True
        return

    clear_settings_cache()
    try:
        response = client.get("/health")
        assert response.json()["keys_ok"] is False
    finally:
        clear_settings_cache()


def test_server_binds_localhost_only() -> None:
    """SERVER_HOST must be 127.0.0.1, never 0.0.0.0 (spec §21 / D-010)."""
    assert SERVER_HOST == "127.0.0.1"
    assert SERVER_HOST != "0.0.0.0"
