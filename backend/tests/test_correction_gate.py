"""Tests for the transcript correction gate (T-106).

Covers:
  - Gate is a REAL pause: downstream stages do not run before POST (quality keystone).
  - GET /jobs/{id}/transcript: happy path, unknown job, transcript not ready.
  - POST /jobs/{id}/transcript: happy path (resumes pipeline), malformed body (stays paused),
    job not in awaiting_correction (409), unknown job (404).
  - Arabic codepoint preservation in transcript_corrected.json (BIDI trap defence).

All tests use the GeminiClient injection seam — no real API calls.
Arabic content is verified by codepoint, not visual appearance (BIDI trap — BUILD_STATE §5).
"""

from __future__ import annotations

import asyncio
import functools
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.clients.gemini import GeminiClient
from app.config import Settings
from app.jobs.manager import JobManager, Stage
from app.main import app
from app.pipeline.asr import run_asr
from app.pipeline.correction_gate import CORRECTION_GATE_STAGE

FIXTURES = Path(__file__).parent / "fixtures" / "gemini"


# ---------------------------------------------------------------------------
# Shared test helpers
# ---------------------------------------------------------------------------


def _fixture_transport(name: str):
    """Return a transport callable that serves the named fixture JSON."""
    data = json.loads((FIXTURES / f"{name}.json").read_text(encoding="utf-8"))

    def transport(method: str, model_id: str, payload: dict, api_key: str) -> dict:
        return data

    return transport


def _key_safe_settings() -> Settings:
    return Settings(_env_file="/nonexistent/.env", gemini_api_key="test-key-gate")  # type: ignore[arg-type]


def _make_asr_stage() -> Stage:
    client = GeminiClient(
        transport=_fixture_transport("asr_transcribe_response"),
        backoff_s=0,
    )
    return Stage(name="asr", run=functools.partial(run_asr, _gemini_client=client))


def _make_stub_stage(ran_list: list) -> Stage:
    """Return a downstream stub stage that records it ran."""

    async def _stub(ctx) -> None:
        ran_list.append(True)

    return Stage(name="downstream_stub", run=_stub)


def _run_to_gate(mgr: JobManager, job_id: str, downstream_ran: list | None = None) -> None:
    """Run the pipeline through ASR + correction gate (+ optional stub downstream)."""
    stages: list[Stage] = [_make_asr_stage(), CORRECTION_GATE_STAGE]
    if downstream_ran is not None:
        stages.append(_make_stub_stage(downstream_ran))

    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        asyncio.run(mgr.run_pipeline(job_id, stages))


def _make_job_at_gate(tmp_path: Path, downstream_ran: list | None = None):
    """Create a manager, job, and advance it to the gate. Returns (mgr, job)."""
    jobs_root = tmp_path / "jobs"
    mgr = JobManager(jobs_root=jobs_root)
    job = mgr.create("kitA", "cold-brew promo")
    (jobs_root / job.job_id / "audio.wav").write_bytes(b"fake-wav")
    _run_to_gate(mgr, job.job_id, downstream_ran)
    return mgr, job


# ---------------------------------------------------------------------------
# Gate is a real pause (quality keystone)
# ---------------------------------------------------------------------------


def test_gate_pauses_pipeline_in_awaiting_correction(tmp_path: Path) -> None:
    """After ASR + gate, job state is AWAITING_CORRECTION."""
    mgr, job = _make_job_at_gate(tmp_path)
    assert mgr.status(job.job_id).state.value == "awaiting_correction"


def test_downstream_stage_did_not_run_before_post(tmp_path: Path) -> None:
    """Downstream stage must NOT execute until the operator POSTs a corrected transcript."""
    ran = []
    mgr, job = _make_job_at_gate(tmp_path, downstream_ran=ran)
    assert mgr.status(job.job_id).state.value == "awaiting_correction"
    assert ran == [], "Downstream stage ran before correction was submitted — gate is broken"


def test_transcript_raw_json_written_before_gate(tmp_path: Path) -> None:
    """transcript_raw.json must exist on disk when the gate pauses."""
    mgr, job = _make_job_at_gate(tmp_path)
    raw = tmp_path / "jobs" / job.job_id / "transcript_raw.json"
    assert raw.exists(), "transcript_raw.json must be written by the ASR stage before the gate"


# ---------------------------------------------------------------------------
# GET /jobs/{id}/transcript
# ---------------------------------------------------------------------------


def test_get_transcript_returns_raw_segments(tmp_path: Path) -> None:
    """GET returns the raw transcript segments and top-level fields."""
    mgr, job = _make_job_at_gate(tmp_path)
    app.state.job_manager = mgr

    client = TestClient(app)
    resp = client.get(f"/jobs/{job.job_id}/transcript")
    assert resp.status_code == 200

    data = resp.json()
    assert data["job_id"] == job.job_id
    assert "model_id" in data
    assert isinstance(data["segments"], list)
    assert len(data["segments"]) == 2


def test_get_transcript_unknown_job_404(tmp_path: Path) -> None:
    """GET with a nonexistent job ID returns 404."""
    mgr = JobManager(jobs_root=tmp_path / "jobs")
    app.state.job_manager = mgr

    client = TestClient(app)
    resp = client.get("/jobs/no-such-job/transcript")
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


def test_get_transcript_before_asr_completes_404(tmp_path: Path) -> None:
    """GET returns 404 when transcript_raw.json does not exist yet."""
    jobs_root = tmp_path / "jobs"
    mgr = JobManager(jobs_root=jobs_root)
    job = mgr.create("kitA", "brief")
    # No ASR run — transcript_raw.json does not exist
    app.state.job_manager = mgr

    client = TestClient(app)
    resp = client.get(f"/jobs/{job.job_id}/transcript")
    assert resp.status_code == 404
    assert "not ready" in resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# POST /jobs/{id}/transcript — happy path
# ---------------------------------------------------------------------------


def test_post_transcript_writes_corrected_json(tmp_path: Path) -> None:
    """POST writes transcript_corrected.json at the job root."""
    mgr, job = _make_job_at_gate(tmp_path)
    app.state.job_manager = mgr

    raw = json.loads(
        (tmp_path / "jobs" / job.job_id / "transcript_raw.json").read_text(encoding="utf-8")
    )

    client = TestClient(app)
    resp = client.post(f"/jobs/{job.job_id}/transcript", json=raw)
    assert resp.status_code == 200

    corrected_path = tmp_path / "jobs" / job.job_id / "transcript_corrected.json"
    assert corrected_path.exists(), "transcript_corrected.json must be written at the job root"


def test_post_transcript_corrected_json_at_root_not_assets(tmp_path: Path) -> None:
    """transcript_corrected.json must be at job_dir/, NOT under assets/."""
    mgr, job = _make_job_at_gate(tmp_path)
    app.state.job_manager = mgr
    raw = json.loads(
        (tmp_path / "jobs" / job.job_id / "transcript_raw.json").read_text(encoding="utf-8")
    )

    client = TestClient(app)
    client.post(f"/jobs/{job.job_id}/transcript", json=raw)

    assert (tmp_path / "jobs" / job.job_id / "transcript_corrected.json").exists()
    assert not (tmp_path / "jobs" / job.job_id / "assets" / "transcript_corrected.json").exists()


def test_post_transcript_resumes_pipeline_downstream_runs(tmp_path: Path) -> None:
    """POST resumes the pipeline and the downstream stub stage executes."""
    ran = []
    mgr, job = _make_job_at_gate(tmp_path, downstream_ran=ran)
    assert ran == []

    app.state.job_manager = mgr
    raw = json.loads(
        (tmp_path / "jobs" / job.job_id / "transcript_raw.json").read_text(encoding="utf-8")
    )

    client = TestClient(app)
    resp = client.post(f"/jobs/{job.job_id}/transcript", json=raw)
    assert resp.status_code == 200

    assert ran == [True], "Downstream stage must run after the operator submits the correction"


def test_post_transcript_advances_state_to_ready_for_ae(tmp_path: Path) -> None:
    """After POST + resume with no further gates, state reaches ready_for_ae."""
    ran = []
    mgr, job = _make_job_at_gate(tmp_path, downstream_ran=ran)
    app.state.job_manager = mgr
    raw = json.loads(
        (tmp_path / "jobs" / job.job_id / "transcript_raw.json").read_text(encoding="utf-8")
    )

    client = TestClient(app)
    client.post(f"/jobs/{job.job_id}/transcript", json=raw)

    assert mgr.status(job.job_id).state.value == "ready_for_ae"
    assert mgr.status(job.job_id).progress_pct == 100.0


def test_post_transcript_job_id_from_url_wins(tmp_path: Path) -> None:
    """transcript_corrected.json uses the URL job_id, not the body's job_id (D-027)."""
    mgr, job = _make_job_at_gate(tmp_path)
    app.state.job_manager = mgr
    raw = json.loads(
        (tmp_path / "jobs" / job.job_id / "transcript_raw.json").read_text(encoding="utf-8")
    )
    raw["job_id"] = "WRONG-ID"  # body has wrong id; URL must win

    client = TestClient(app)
    client.post(f"/jobs/{job.job_id}/transcript", json=raw)

    corrected = json.loads(
        (tmp_path / "jobs" / job.job_id / "transcript_corrected.json").read_text(encoding="utf-8")
    )
    assert corrected["job_id"] == job.job_id, "job_id in transcript_corrected.json must come from the URL"


# ---------------------------------------------------------------------------
# POST — malformed body (stays paused)
# ---------------------------------------------------------------------------


def test_post_malformed_body_returns_422(tmp_path: Path) -> None:
    """Malformed POST body (segments is a string, not a list) → 422."""
    mgr, job = _make_job_at_gate(tmp_path)
    app.state.job_manager = mgr

    bad_body = {"job_id": job.job_id, "model_id": "gemini-2.5-flash", "segments": "not-a-list"}

    client = TestClient(app)
    resp = client.post(f"/jobs/{job.job_id}/transcript", json=bad_body)
    assert resp.status_code == 422


def test_post_malformed_body_job_stays_paused(tmp_path: Path) -> None:
    """After a malformed POST, the job remains in awaiting_correction."""
    mgr, job = _make_job_at_gate(tmp_path)
    app.state.job_manager = mgr

    bad_body = {"job_id": job.job_id, "model_id": "m", "segments": 42}

    client = TestClient(app)
    client.post(f"/jobs/{job.job_id}/transcript", json=bad_body)

    assert mgr.status(job.job_id).state.value == "awaiting_correction"


def test_post_malformed_body_does_not_write_corrected_json(tmp_path: Path) -> None:
    """transcript_corrected.json must NOT be written after a malformed POST."""
    mgr, job = _make_job_at_gate(tmp_path)
    app.state.job_manager = mgr

    bad_body = {"segments": [{"MISSING_index": True, "MISSING_text": True}]}

    client = TestClient(app)
    client.post(f"/jobs/{job.job_id}/transcript", json=bad_body)

    assert not (tmp_path / "jobs" / job.job_id / "transcript_corrected.json").exists()


def test_post_malformed_body_downstream_does_not_run(tmp_path: Path) -> None:
    """Downstream stage must NOT run when the POST body is malformed."""
    ran = []
    mgr, job = _make_job_at_gate(tmp_path, downstream_ran=ran)
    app.state.job_manager = mgr

    bad_body = {"job_id": job.job_id, "model_id": "m", "segments": "bad"}
    client = TestClient(app)
    client.post(f"/jobs/{job.job_id}/transcript", json=bad_body)

    assert ran == []


# ---------------------------------------------------------------------------
# POST — job not in awaiting_correction (409)
# ---------------------------------------------------------------------------


def test_post_transcript_not_at_gate_returns_409(tmp_path: Path) -> None:
    """POST to a job that is not awaiting_correction returns 409."""
    jobs_root = tmp_path / "jobs"
    mgr = JobManager(jobs_root=jobs_root)
    job = mgr.create("kitA", "brief")
    # Job is in RUNNING state (never reached the gate)
    app.state.job_manager = mgr

    body = {"job_id": job.job_id, "model_id": "m", "segments": []}
    client = TestClient(app)
    resp = client.post(f"/jobs/{job.job_id}/transcript", json=body)
    assert resp.status_code == 409
    assert "awaiting_correction" in resp.json()["detail"]


def test_post_transcript_already_resumed_returns_409(tmp_path: Path) -> None:
    """Second POST to the same gate (already resumed) returns 409."""
    ran = []
    mgr, job = _make_job_at_gate(tmp_path, downstream_ran=ran)
    app.state.job_manager = mgr
    raw = json.loads(
        (tmp_path / "jobs" / job.job_id / "transcript_raw.json").read_text(encoding="utf-8")
    )

    client = TestClient(app)
    r1 = client.post(f"/jobs/{job.job_id}/transcript", json=raw)
    assert r1.status_code == 200

    r2 = client.post(f"/jobs/{job.job_id}/transcript", json=raw)
    assert r2.status_code == 409


# ---------------------------------------------------------------------------
# GET and POST — unknown job (404)
# ---------------------------------------------------------------------------


def test_get_transcript_nonexistent_job_404(tmp_path: Path) -> None:
    mgr = JobManager(jobs_root=tmp_path / "jobs")
    app.state.job_manager = mgr
    resp = TestClient(app).get("/jobs/ghost-job/transcript")
    assert resp.status_code == 404


def test_post_transcript_nonexistent_job_404(tmp_path: Path) -> None:
    mgr = JobManager(jobs_root=tmp_path / "jobs")
    app.state.job_manager = mgr
    body = {"job_id": "ghost", "model_id": "m", "segments": []}
    resp = TestClient(app).post("/jobs/ghost-job/transcript", json=body)
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Arabic codepoint preservation (BIDI trap defence)
# ---------------------------------------------------------------------------


def test_arabic_preserved_in_corrected_json(tmp_path: Path) -> None:
    """Arabic text from the corrected transcript is stored in logical codepoint order.

    Verified by codepoint value, NOT visual appearance (BIDI display trap — BUILD_STATE §5).
    """
    mgr, job = _make_job_at_gate(tmp_path)
    app.state.job_manager = mgr

    raw = json.loads(
        (tmp_path / "jobs" / job.job_id / "transcript_raw.json").read_text(encoding="utf-8")
    )
    # The fixture's seg0 starts with سلام (U+0633 U+0644 U+0627 U+0645)
    seg0_text = raw["segments"][0]["text"]
    assert any(0x0600 <= ord(c) <= 0x06FF for c in seg0_text), (
        "Fixture seg0 must contain Arabic codepoints for this test to be meaningful"
    )

    client = TestClient(app)
    client.post(f"/jobs/{job.job_id}/transcript", json=raw)

    corrected = json.loads(
        (tmp_path / "jobs" / job.job_id / "transcript_corrected.json").read_text(encoding="utf-8")
    )
    out_text = corrected["segments"][0]["text"]

    # سلام: logical order is U+0633 U+0644 U+0627 U+0645
    assert ord(out_text[0]) == 0x0633, f"Expected U+0633 (س), got U+{ord(out_text[0]):04X}"
    assert ord(out_text[1]) == 0x0644, f"Expected U+0644 (ل), got U+{ord(out_text[1]):04X}"
    assert ord(out_text[2]) == 0x0627, f"Expected U+0627 (ا), got U+{ord(out_text[2]):04X}"
    assert ord(out_text[3]) == 0x0645, f"Expected U+0645 (م), got U+{ord(out_text[3]):04X}"


def test_corrected_json_is_utf8_not_ascii_escaped(tmp_path: Path) -> None:
    """transcript_corrected.json must contain raw Arabic chars, not \\uXXXX escapes."""
    mgr, job = _make_job_at_gate(tmp_path)
    app.state.job_manager = mgr
    raw = json.loads(
        (tmp_path / "jobs" / job.job_id / "transcript_raw.json").read_text(encoding="utf-8")
    )

    client = TestClient(app)
    client.post(f"/jobs/{job.job_id}/transcript", json=raw)

    raw_bytes = (
        tmp_path / "jobs" / job.job_id / "transcript_corrected.json"
    ).read_text(encoding="utf-8")
    # ensure_ascii=False means Arabic appears as ا not ا
    assert "\\u0633" not in raw_bytes, (
        "Arabic must be stored as raw UTF-8 codepoints, not \\u-escaped ASCII"
    )
