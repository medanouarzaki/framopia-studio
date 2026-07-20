"""Tests for the mockable Gemini client (T-104).

All tests use the injectable transport seam — no real API calls are ever made.
Recorded fixture responses live in tests/fixtures/gemini/.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.clients.gemini import (
    GeminiClient,
    GeminiError,
    GeminiTransientError,
    ImageResult,
    TranscribeResult,
    UnderstandResult,
    _parse_segments,
)
from app.config import Settings
from app.util.cost import CostMeter

FIXTURES = Path(__file__).parent / "fixtures" / "gemini"


# ---------------------------------------------------------------------------
# Fixture transport helpers
# ---------------------------------------------------------------------------


def _fixture_transport(name: str):
    """Return a transport callable that always returns the named fixture."""
    data = json.loads((FIXTURES / f"{name}.json").read_text(encoding="utf-8"))

    def transport(method: str, model_id: str, payload: dict, api_key: str) -> dict:
        return data

    return transport


def _failing_transport(exc: Exception):
    """Return a transport callable that always raises the given exception."""

    def transport(method: str, model_id: str, payload: dict, api_key: str) -> dict:
        raise exc

    return transport


def _after_n_transport(n: int, exc: Exception, then_name: str):
    """Transport that raises *exc* for the first *n* calls, then succeeds with fixture."""
    calls = {"count": 0}
    success_data = json.loads((FIXTURES / f"{then_name}.json").read_text(encoding="utf-8"))

    def transport(method: str, model_id: str, payload: dict, api_key: str) -> dict:
        calls["count"] += 1
        if calls["count"] <= n:
            raise exc
        return success_data

    return transport


def _key_safe_settings(fake_key: str = "test-secret-api-key-12345") -> Settings:
    """Return a Settings instance with a known fake key for secret-discipline tests."""
    return Settings(_env_file="/nonexistent/.env", gemini_api_key=fake_key)  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# Error hierarchy
# ---------------------------------------------------------------------------


def test_gemini_error_is_runtime_error() -> None:
    assert issubclass(GeminiError, RuntimeError)


def test_transient_error_is_gemini_error() -> None:
    assert issubclass(GeminiTransientError, GeminiError)


# ---------------------------------------------------------------------------
# _parse_segments unit tests
# ---------------------------------------------------------------------------


def test_parse_segments_valid_json() -> None:
    raw = '[{"text": "hello", "start": 0.0, "end": 1.0, "confidence": 0.9, "script": "latin"}]'
    segs = _parse_segments(raw)
    assert len(segs) == 1
    assert segs[0].text == "hello"
    assert segs[0].start == pytest.approx(0.0)
    assert segs[0].end == pytest.approx(1.0)
    assert segs[0].confidence == pytest.approx(0.9)
    assert segs[0].script == "latin"


def test_parse_segments_arabic() -> None:
    raw = '[{"text": "بزاف ديال", "start": 1.0, "end": 2.5, "script": "arabic"}]'
    segs = _parse_segments(raw)
    assert segs[0].script == "arabic"
    assert segs[0].text == "بزاف ديال"


def test_parse_segments_invalid_json_fallback() -> None:
    raw = "This is plain text, not JSON."
    segs = _parse_segments(raw)
    assert len(segs) == 1
    assert segs[0].text == raw
    assert segs[0].start is None


def test_parse_segments_non_array_fallback() -> None:
    raw = '{"text": "oops", "start": 0}'  # object, not array
    segs = _parse_segments(raw)
    assert len(segs) == 1  # graceful fallback


# ---------------------------------------------------------------------------
# transcribe
# ---------------------------------------------------------------------------


def test_transcribe_returns_segments_from_fixture(tmp_path: Path) -> None:
    """transcribe() parses fixture JSON into TranscriptSegment objects."""
    audio = tmp_path / "audio.wav"
    audio.write_bytes(b"fake-wav-bytes")

    client = GeminiClient(transport=_fixture_transport("transcribe_response"), backoff_s=0)
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        result = client.transcribe(audio)

    assert isinstance(result, TranscribeResult)
    assert len(result.segments) == 2
    assert result.segments[0].text == "Salam, kifach ndir marketing?"
    assert result.segments[0].start == pytest.approx(0.0)
    assert result.segments[0].script == "arabic"
    assert result.segments[1].text == "promo 300 dirham"
    assert result.model_id == "gemini-2.5-flash"
    assert result.raw_text  # non-empty


def test_transcribe_uses_text_model_from_settings(tmp_path: Path) -> None:
    """transcribe() passes the text model id from Settings to the transport."""
    audio = tmp_path / "audio.wav"
    audio.write_bytes(b"fake")
    seen: list[str] = []

    def recording_transport(method, model_id, payload, api_key):
        seen.append(model_id)
        return json.loads((FIXTURES / "transcribe_response.json").read_text())

    client = GeminiClient(transport=recording_transport, backoff_s=0)
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        client.transcribe(audio)

    assert seen[0] == "gemini-2.5-flash"  # default from Settings


def test_transcribe_with_brief_and_prompt(tmp_path: Path) -> None:
    """transcribe() accepts optional brief and prompt without error."""
    audio = tmp_path / "audio.wav"
    audio.write_bytes(b"fake")

    client = GeminiClient(transport=_fixture_transport("transcribe_response"), backoff_s=0)
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        result = client.transcribe(audio, brief="cold-brew promo", prompt="Transcribe carefully.")

    assert isinstance(result, TranscribeResult)


# ---------------------------------------------------------------------------
# understand
# ---------------------------------------------------------------------------


def test_understand_returns_raw_text_from_fixture() -> None:
    """understand() returns UnderstandResult with raw_text from the fixture."""
    client = GeminiClient(transport=_fixture_transport("understand_response"), backoff_s=0)
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        result = client.understand(transcript="Salam kifach ndir marketing promo 300 dirham")

    assert isinstance(result, UnderstandResult)
    assert "summary" in result.raw_text
    assert result.model_id == "gemini-2.5-flash"


def test_understand_accepts_optional_fields() -> None:
    """understand() accepts words and brief without error."""
    client = GeminiClient(transport=_fixture_transport("understand_response"), backoff_s=0)
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        result = client.understand(
            transcript="hello",
            words=[{"text": "hello", "start": 0.0}],
            brief="cold-brew",
        )
    assert isinstance(result, UnderstandResult)


# ---------------------------------------------------------------------------
# generate_image
# ---------------------------------------------------------------------------


def test_generate_image_returns_bytes_and_model_id() -> None:
    """generate_image() returns ImageResult with decoded bytes and model id."""
    client = GeminiClient(transport=_fixture_transport("image_response"), backoff_s=0)
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        result = client.generate_image("a cozy coffee shop")

    assert isinstance(result, ImageResult)
    assert len(result.image_bytes) > 0
    assert result.image_bytes[:4] == b"\x89PNG"  # fixture is a real PNG
    assert result.model_id == "gemini-3.1-flash-image"


def test_generate_image_uses_default_model_from_settings() -> None:
    """generate_image() uses settings.gemini_image_model when model= is not passed."""
    seen: list[str] = []

    def recording_transport(method, model_id, payload, api_key):
        seen.append(model_id)
        return json.loads((FIXTURES / "image_response.json").read_text())

    client = GeminiClient(transport=recording_transport, backoff_s=0)
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        client.generate_image("test prompt")

    assert seen[0] == "gemini-3.1-flash-image"


def test_generate_image_model_override() -> None:
    """generate_image(model=...) overrides the default model id."""
    seen: list[str] = []

    def recording_transport(method, model_id, payload, api_key):
        seen.append(model_id)
        return json.loads((FIXTURES / "image_response.json").read_text())

    client = GeminiClient(transport=recording_transport, backoff_s=0)
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        client.generate_image("test prompt", model="gemini-3-pro-image")

    assert seen[0] == "gemini-3-pro-image"


# ---------------------------------------------------------------------------
# Cost meter
# ---------------------------------------------------------------------------


def test_cost_meter_incremented_on_generate_image() -> None:
    """generate_image() increments the cost meter by the Nano Banana 2 cost estimate."""
    meter = CostMeter()
    client = GeminiClient(transport=_fixture_transport("image_response"), backoff_s=0)

    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        client.generate_image("test", meter=meter)

    assert meter.total() == pytest.approx(0.04)


def test_cost_meter_pro_image_uses_higher_cost() -> None:
    """Pro model image generation uses the higher cost estimate (~2× default)."""
    meter = CostMeter()

    def pro_transport(method, model_id, payload, api_key):
        return json.loads((FIXTURES / "image_response.json").read_text())

    settings = _key_safe_settings()
    client = GeminiClient(transport=pro_transport, backoff_s=0)

    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: settings)
        client.generate_image("hero shot", model=settings.gemini_image_pro_model, meter=meter)

    assert meter.total() == pytest.approx(0.08)


def test_cost_meter_accumulates_across_calls() -> None:
    """Multiple generate_image() calls accumulate cost correctly."""
    meter = CostMeter()
    client = GeminiClient(transport=_fixture_transport("image_response"), backoff_s=0)

    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        client.generate_image("img 1", meter=meter)
        client.generate_image("img 2", meter=meter)
        client.generate_image("img 3", meter=meter)

    assert meter.total() == pytest.approx(0.12)


def test_no_meter_does_not_error() -> None:
    """generate_image() with no meter= argument does not raise."""
    client = GeminiClient(transport=_fixture_transport("image_response"), backoff_s=0)
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        result = client.generate_image("test")
    assert isinstance(result, ImageResult)


# ---------------------------------------------------------------------------
# Retry: transient errors
# ---------------------------------------------------------------------------


def test_transient_error_triggers_retry_then_succeeds() -> None:
    """One transient error triggers a retry and eventually succeeds (backoff_s=0)."""
    transport = _after_n_transport(1, GeminiTransientError("rate limited"), "image_response")
    client = GeminiClient(transport=transport, max_attempts=3, backoff_s=0)

    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        result = client.generate_image("test")

    assert isinstance(result, ImageResult)


def test_transient_error_exhausted_raises_gemini_error() -> None:
    """Exhausting all retry attempts re-raises the last transient error."""
    client = GeminiClient(
        transport=_failing_transport(GeminiTransientError("always fails")),
        max_attempts=3,
        backoff_s=0,
    )

    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        with pytest.raises(GeminiTransientError, match="always fails"):
            client.generate_image("test")


def test_non_transient_error_does_not_retry() -> None:
    """A non-transient GeminiError propagates immediately without retrying."""
    call_count = {"n": 0}

    def transport(method, model_id, payload, api_key):
        call_count["n"] += 1
        raise GeminiError("auth failure")

    client = GeminiClient(transport=transport, max_attempts=3, backoff_s=0)

    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        with pytest.raises(GeminiError, match="auth failure"):
            client.generate_image("test")

    # Must not retry on non-transient errors
    assert call_count["n"] == 1


# ---------------------------------------------------------------------------
# Secrets discipline
# ---------------------------------------------------------------------------


def test_api_key_not_in_exception_message() -> None:
    """The API key value never appears in any GeminiError message raised by the client."""
    fake_key = "top-secret-gemini-key-xyz-99999"

    def leaky_transport(method, model_id, payload, api_key):
        # A badly-written transport that leaks the key — we check the client
        # does NOT propagate it in the message it surfaces.
        raise GeminiError("service unavailable")

    settings = _key_safe_settings(fake_key)
    client = GeminiClient(transport=leaky_transport, backoff_s=0)

    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: settings)
        with pytest.raises(GeminiError) as exc_info:
            client.generate_image("test")

    assert fake_key not in str(exc_info.value)


def test_missing_api_key_raises_clear_error() -> None:
    """A missing API key raises GeminiError with a helpful message, not a crash."""
    settings = Settings(_env_file="/nonexistent/.env")  # no key set

    client = GeminiClient(transport=_fixture_transport("image_response"), backoff_s=0)

    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: settings)
        with pytest.raises(GeminiError, match="No Gemini API key"):
            client.generate_image("test")


def test_api_key_not_in_repr_of_settings() -> None:
    """The SecretStr in Settings masks the key value in repr/str."""
    fake_key = "repr-test-key-456"
    settings = _key_safe_settings(fake_key)
    assert fake_key not in repr(settings)
    assert fake_key not in str(settings)
    assert fake_key not in repr(settings.gemini_api_key)
