"""Tests for the ASR pipeline stage (T-105).

All tests use the GeminiClient injection seam — no real API calls are ever made.
Arabic content in fixtures is verified by codepoint, not visual appearance,
per the bidi display trap note in BUILD_STATE §5 / PROGRESS.md.
"""

from __future__ import annotations

import asyncio
import functools
import json
from pathlib import Path

import pytest

from app.clients.gemini import GeminiClient, GeminiError
from app.config import Settings
from app.jobs.manager import JobManager, Stage
from app.pipeline.asr import _PROMPT_PATH, run_asr

FIXTURES = Path(__file__).parent / "fixtures" / "gemini"


# ---------------------------------------------------------------------------
# Transport helpers
# ---------------------------------------------------------------------------


def _fixture_transport(name: str):
    """Return a transport callable that returns the named fixture."""
    data = json.loads((FIXTURES / f"{name}.json").read_text(encoding="utf-8"))

    def transport(method: str, model_id: str, payload: dict, api_key: str) -> dict:
        return data

    return transport


def _key_safe_settings() -> Settings:
    return Settings(_env_file="/nonexistent/.env", gemini_api_key="test-key-for-asr")  # type: ignore[arg-type]


def _make_stage_with_client(client: GeminiClient) -> Stage:
    """Wire a GeminiClient into the ASR stage via partial injection."""
    return Stage(name="asr", run=functools.partial(run_asr, _gemini_client=client))


# ---------------------------------------------------------------------------
# Prompt file tests
# ---------------------------------------------------------------------------


def test_asr_prompt_file_exists() -> None:
    """app/prompts/asr.md must exist (the stage reads it at runtime)."""
    assert _PROMPT_PATH.exists(), f"Prompt file not found: {_PROMPT_PATH}"
    assert _PROMPT_PATH.is_file()


def test_asr_prompt_contains_latin_script_rule() -> None:
    """The prompt must encode the §11.2 French/English → Latin script rule."""
    prompt = _PROMPT_PATH.read_text(encoding="utf-8")
    # Both the concept and the direction must be present
    assert "Latin" in prompt or "latin" in prompt.lower(), (
        "Prompt missing the Latin-script rule for French/English words"
    )
    # At least one Latin-script example or direction
    assert any(word in prompt for word in ("marketing", "promo", "French", "English")), (
        "Prompt missing a concrete Latin-script example or language mention"
    )


def test_asr_prompt_contains_arabic_script_rule() -> None:
    """The prompt must encode the §11.2 Darija/Arabic → Arabic script rule."""
    prompt = _PROMPT_PATH.read_text(encoding="utf-8")
    assert "Arabic" in prompt or "arabic" in prompt.lower(), (
        "Prompt missing the Arabic-script rule for Darija words"
    )
    # Must contain at least one Arabic codepoint as a concrete example
    has_arabic_codepoint = any(0x0600 <= ord(c) <= 0x06FF for c in prompt)
    assert has_arabic_codepoint, (
        "Prompt must include at least one Arabic-script example (Arabic codepoints)"
    )


# ---------------------------------------------------------------------------
# transcript_raw.json shape
# ---------------------------------------------------------------------------


def test_happy_path_produces_transcript_raw_json(tmp_path: Path) -> None:
    """Given a mocked Gemini response, the stage writes a well-formed transcript_raw.json."""
    jobs_root = tmp_path / "jobs"
    mgr = JobManager(jobs_root=jobs_root)
    job = mgr.create("kitA", "cold-brew promo")
    (jobs_root / job.job_id / "audio.wav").write_bytes(b"fake-wav")

    client = GeminiClient(
        transport=_fixture_transport("asr_transcribe_response"),
        backoff_s=0,
    )
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        asyncio.run(mgr.run_pipeline(job.job_id, [_make_stage_with_client(client)]))

    status = mgr.status(job.job_id)
    assert status.state.value == "ready_for_ae", status.message

    out = jobs_root / job.job_id / "transcript_raw.json"
    assert out.exists(), "transcript_raw.json must exist at job root"

    data = json.loads(out.read_text(encoding="utf-8"))
    assert data["job_id"] == job.job_id
    assert data["model_id"] == "gemini-2.5-flash"
    assert isinstance(data["segments"], list)
    assert len(data["segments"]) == 2


def test_transcript_raw_json_segment_shape(tmp_path: Path) -> None:
    """Each segment in transcript_raw.json has {index, text, start, end, confidence}."""
    jobs_root = tmp_path / "jobs"
    mgr = JobManager(jobs_root=jobs_root)
    job = mgr.create("kitA", "brief")
    (jobs_root / job.job_id / "audio.wav").write_bytes(b"fake-wav")

    client = GeminiClient(
        transport=_fixture_transport("asr_transcribe_response"),
        backoff_s=0,
    )
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        asyncio.run(mgr.run_pipeline(job.job_id, [_make_stage_with_client(client)]))

    data = json.loads(
        (jobs_root / job.job_id / "transcript_raw.json").read_text(encoding="utf-8")
    )
    seg0 = data["segments"][0]
    seg1 = data["segments"][1]

    # Required fields
    for seg in (seg0, seg1):
        assert "index" in seg
        assert "text" in seg
        assert "start" in seg
        assert "end" in seg
        assert "confidence" in seg

    # 0-based ordering
    assert seg0["index"] == 0
    assert seg1["index"] == 1


def test_transcript_at_job_root_not_under_assets(tmp_path: Path) -> None:
    """transcript_raw.json must be at job_dir/transcript_raw.json, NOT under assets/."""
    jobs_root = tmp_path / "jobs"
    mgr = JobManager(jobs_root=jobs_root)
    job = mgr.create("kitA", "brief")
    (jobs_root / job.job_id / "audio.wav").write_bytes(b"fake-wav")

    client = GeminiClient(
        transport=_fixture_transport("asr_transcribe_response"),
        backoff_s=0,
    )
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        asyncio.run(mgr.run_pipeline(job.job_id, [_make_stage_with_client(client)]))

    job_dir = jobs_root / job.job_id
    assert (job_dir / "transcript_raw.json").exists()
    assert not (job_dir / "assets" / "transcript_raw.json").exists()


# ---------------------------------------------------------------------------
# Mixed-script: codepoint verification (BIDI trap defence)
# ---------------------------------------------------------------------------


def test_arabic_codepoints_preserved_in_transcript(tmp_path: Path) -> None:
    """Arabic text in the fixture is stored in correct logical (codepoint) order in the output.

    Verified by codepoint value, NOT by visual appearance (bidi display trap — BUILD_STATE §5).
    The fixture's first segment starts with سلام (U+0633 U+0644 U+0627 U+0645).
    """
    jobs_root = tmp_path / "jobs"
    mgr = JobManager(jobs_root=jobs_root)
    job = mgr.create("kitA", "brief")
    (jobs_root / job.job_id / "audio.wav").write_bytes(b"fake-wav")

    client = GeminiClient(
        transport=_fixture_transport("asr_transcribe_response"),
        backoff_s=0,
    )
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        asyncio.run(mgr.run_pipeline(job.job_id, [_make_stage_with_client(client)]))

    data = json.loads(
        (jobs_root / job.job_id / "transcript_raw.json").read_text(encoding="utf-8")
    )
    seg0_text = data["segments"][0]["text"]

    # سلام in logical codepoint order: س ل ا م
    assert ord(seg0_text[0]) == 0x0633, f"Expected U+0633 (س), got U+{ord(seg0_text[0]):04X}"
    assert ord(seg0_text[1]) == 0x0644, f"Expected U+0644 (ل), got U+{ord(seg0_text[1]):04X}"
    assert ord(seg0_text[2]) == 0x0627, f"Expected U+0627 (ا), got U+{ord(seg0_text[2]):04X}"
    assert ord(seg0_text[3]) == 0x0645, f"Expected U+0645 (م), got U+{ord(seg0_text[3]):04X}"

    # Second segment must contain at least one Latin character (promo/dirham)
    seg1_text = data["segments"][1]["text"]
    has_latin = any("a" <= c.lower() <= "z" for c in seg1_text)
    assert has_latin, f"Second segment should contain Latin text, got: {seg1_text!r}"

    # Second segment also contains Arabic (بزاف): U+0628 U+0632 U+0627 U+0641
    has_arabic = any(0x0600 <= ord(c) <= 0x06FF for c in seg1_text)
    assert has_arabic, "Second segment should also contain Arabic codepoints (بزاف)"


def test_script_hint_preserved_in_output(tmp_path: Path) -> None:
    """The script hint from the Gemini response is carried into transcript_raw.json."""
    jobs_root = tmp_path / "jobs"
    mgr = JobManager(jobs_root=jobs_root)
    job = mgr.create("kitA", "brief")
    (jobs_root / job.job_id / "audio.wav").write_bytes(b"fake-wav")

    client = GeminiClient(
        transport=_fixture_transport("asr_transcribe_response"),
        backoff_s=0,
    )
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        asyncio.run(mgr.run_pipeline(job.job_id, [_make_stage_with_client(client)]))

    data = json.loads(
        (jobs_root / job.job_id / "transcript_raw.json").read_text(encoding="utf-8")
    )
    assert data["segments"][0].get("script") == "arabic"
    assert data["segments"][1].get("script") == "latin"


# ---------------------------------------------------------------------------
# Missing audio.wav
# ---------------------------------------------------------------------------


def test_missing_audio_wav_produces_error(tmp_path: Path) -> None:
    """Missing audio.wav → clear AsrError → runner state=error with message."""
    jobs_root = tmp_path / "jobs"
    mgr = JobManager(jobs_root=jobs_root)
    job = mgr.create("kitA", "brief")
    # Do NOT write audio.wav

    client = GeminiClient(
        transport=_fixture_transport("asr_transcribe_response"),
        backoff_s=0,
    )
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        asyncio.run(mgr.run_pipeline(job.job_id, [_make_stage_with_client(client)]))

    status = mgr.status(job.job_id)
    assert status.state.value == "error"
    assert "audio.wav" in status.message
    assert "not found" in status.message.lower()


def test_missing_audio_wav_does_not_write_transcript(tmp_path: Path) -> None:
    """No transcript_raw.json must be written when audio.wav is missing."""
    jobs_root = tmp_path / "jobs"
    mgr = JobManager(jobs_root=jobs_root)
    job = mgr.create("kitA", "brief")

    client = GeminiClient(
        transport=_fixture_transport("asr_transcribe_response"),
        backoff_s=0,
    )
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        asyncio.run(mgr.run_pipeline(job.job_id, [_make_stage_with_client(client)]))

    assert not (jobs_root / job.job_id / "transcript_raw.json").exists()


# ---------------------------------------------------------------------------
# Gemini error surfacing
# ---------------------------------------------------------------------------


def test_gemini_error_surfaces_as_stage_error(tmp_path: Path) -> None:
    """GeminiError from the client sets runner state=error with a human-readable message."""
    jobs_root = tmp_path / "jobs"
    mgr = JobManager(jobs_root=jobs_root)
    job = mgr.create("kitA", "brief")
    (jobs_root / job.job_id / "audio.wav").write_bytes(b"fake-wav")

    def failing_transport(method, model_id, payload, api_key):
        raise GeminiError("Gemini quota exceeded")

    client = GeminiClient(transport=failing_transport, backoff_s=0)
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        asyncio.run(mgr.run_pipeline(job.job_id, [_make_stage_with_client(client)]))

    status = mgr.status(job.job_id)
    assert status.state.value == "error"
    assert status.message  # non-empty human-readable message


# ---------------------------------------------------------------------------
# Through-runner: success advances status; failure sets error
# ---------------------------------------------------------------------------


def test_through_runner_success_state(tmp_path: Path) -> None:
    """ASR wired into the T-101 runner → READY_FOR_AE + transcript on disk."""
    jobs_root = tmp_path / "jobs"
    mgr = JobManager(jobs_root=jobs_root)
    job = mgr.create("kitA", "brief")
    (jobs_root / job.job_id / "audio.wav").write_bytes(b"fake-wav")

    client = GeminiClient(
        transport=_fixture_transport("asr_transcribe_response"),
        backoff_s=0,
    )
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        asyncio.run(mgr.run_pipeline(job.job_id, [_make_stage_with_client(client)]))

    assert mgr.status(job.job_id).state.value == "ready_for_ae"
    assert mgr.status(job.job_id).progress_pct == 100.0
    assert (jobs_root / job.job_id / "transcript_raw.json").exists()


def test_through_runner_missing_audio_state(tmp_path: Path) -> None:
    """Through-runner: missing audio.wav → state=error with message."""
    jobs_root = tmp_path / "jobs"
    mgr = JobManager(jobs_root=jobs_root)
    job = mgr.create("kitA", "brief")

    client = GeminiClient(
        transport=_fixture_transport("asr_transcribe_response"),
        backoff_s=0,
    )
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        asyncio.run(mgr.run_pipeline(job.job_id, [_make_stage_with_client(client)]))

    status = mgr.status(job.job_id)
    assert status.state.value == "error"
    assert status.message
