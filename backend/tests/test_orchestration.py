"""End-to-end orchestration test (T-113): the full pipeline behind /jobs.

Exercises POST /jobs -> pause at the correction gate -> POST /transcript ->
resume -> ready_for_ae with a valid edit_plan.json on disk, all through the
real FastAPI app + real JobManager + real ffmpeg (ingest/audio stages) with
every EXTERNAL client (Gemini, WhisperX aligner, librosa beat detector, the
committed music library) replaced by fast, deterministic fakes via the
build_pipeline_stages() injection seam (app/jobs/manager.py). No network call
is made anywhere in this test.

The fixture content (2-segment, 7-word Darija/French transcript) is the SAME
canonical content already used by test_align.py / test_understand.py's
fixtures, kept inline here (rather than re-reading those fixture files) so
this test's data flow is self-contained and easy to follow end to end.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.clients.gemini import GeminiClient
from app.config import Settings
from app.jobs.manager import JobManager, build_pipeline_stages
from app.main import app
from app.models.edit_plan import EditPlan
from app.models.validate import validate_edit_plan
from app.pipeline.assemble_plan import V1_TEMPLATE_NAMES

_HAS_FFTOOLS = bool(shutil.which("ffmpeg")) and bool(shutil.which("ffprobe"))
skip_no_fftools = pytest.mark.skipif(
    not _HAS_FFTOOLS, reason="ffmpeg/ffprobe not available in this environment"
)

_REEL_DURATION_S = 5.0

# ---------------------------------------------------------------------------
# Fixture content (self-contained, chains cleanly through every stage)
# ---------------------------------------------------------------------------

_ASR_SEGMENTS = [
    {
        "text": "Salam بزاف ديال promo",
        "start": 0.0,
        "end": 2.0,
        "confidence": 0.95,
        "script": "arabic",
    },
    {
        "text": "مزيان le design",
        "start": 3.5,
        "end": 5.0,
        "confidence": 0.92,
        "script": "arabic",
    },
]

_UNDERSTAND_PAYLOAD = {
    "summary": "المتحدث يروج لعرض قهوة باردة بسعر 300 درهم لجمهور مغربي.",
    "segments": [
        {
            "index": 0,
            "text": "Salam بزاف ديال promo",
            "start": 0.0,
            "end": 2.0,
            "visual_intent": "show product packaging",
            "emphasis_word_indices": [1, 2, 3],
        },
        {
            "index": 1,
            "text": "مزيان le design",
            "start": 3.5,
            "end": 5.0,
            "visual_intent": "speaker only",
            "emphasis_word_indices": [4, 6],
        },
    ],
}

# 1x1 PNG, same fixture bytes used by tests/fixtures/gemini/image_response.json
_IMAGE_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC"
)


def _gemini_transport(method: str, model_id: str, payload: dict, api_key: str) -> dict:
    """Single transport serving both text calls (ASR, then understand) in order,
    plus any number of image calls."""
    if method == "text":
        if not _gemini_transport._text_calls:  # type: ignore[attr-defined]
            _gemini_transport._text_calls.append("asr")  # type: ignore[attr-defined]
            return {"text": json.dumps(_ASR_SEGMENTS, ensure_ascii=False), "model_id": model_id}
        _gemini_transport._text_calls.append("understand")  # type: ignore[attr-defined]
        return {
            "text": json.dumps(_UNDERSTAND_PAYLOAD, ensure_ascii=False),
            "model_id": model_id,
        }
    if method == "image":
        return {"image_bytes_b64": _IMAGE_B64, "model_id": model_id}
    raise AssertionError(f"unexpected transport method: {method!r}")


def _fresh_gemini_client() -> GeminiClient:
    _gemini_transport._text_calls = []  # type: ignore[attr-defined]
    return GeminiClient(transport=_gemini_transport, backoff_s=0)


def _fake_aligner(audio_path: Path, words: list[str]) -> list[tuple[float, float]]:
    """Deterministic: word i -> [i*0.5, i*0.5+0.4] (same shape as test_align.py)."""
    return [(i * 0.5, i * 0.5 + 0.4) for i in range(len(words))]


def _fake_beat_detector(audio_path: Path) -> list[float]:
    """A dense, ascending beat grid covering the whole reel so every visual
    window has a snap point available."""
    return [round(i * 0.25, 2) for i in range(int(_REEL_DURATION_S / 0.25))]


def _key_safe_settings() -> Settings:
    return Settings(
        _env_file="/nonexistent/.env",
        gemini_api_key="test-key-for-orchestration",  # type: ignore[arg-type]
    )


# ---------------------------------------------------------------------------
# Media + library synthesis helpers (no binary media committed)
# ---------------------------------------------------------------------------


def _make_av_clip(path: Path, duration: float = _REEL_DURATION_S) -> Path:
    """Synthesise a 1080x1920 mp4 with both video and audio tracks."""
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-f", "lavfi", "-i", "color=c=blue:s=1080x1920:r=30",
            "-f", "lavfi", "-i", f"sine=frequency=440:duration={duration}",
            "-map", "0:v", "-map", "1:a",
            "-c:v", "libx264", "-c:a", "aac",
            "-t", str(duration),
            str(path),
        ],
        check=True,
    )
    return path


def _make_silent_wav(path: Path, duration_s: float = 1.0, sr: int = 22050) -> None:
    import struct
    import wave

    n_frames = int(duration_s * sr)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(struct.pack(f"<{n_frames}h", *([0] * n_frames)))


def _make_music_library(tmp_path: Path) -> Path:
    music_dir = tmp_path / "music"
    music_dir.mkdir()
    library_path = music_dir / "library.json"
    library_path.write_text(
        json.dumps(
            {
                "tracks": [
                    {
                        "file": "cozy.wav",
                        "type": "music",
                        "mood": ["cozy"],
                        "energy": 2,
                        "bpm": 90,
                        "has_vocals": False,
                        "duration": 60.0,
                    }
                ],
                "sfx": [],
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    _make_silent_wav(music_dir / "cozy.wav")
    return library_path


# ---------------------------------------------------------------------------
# The end-to-end test
# ---------------------------------------------------------------------------


@skip_no_fftools
def test_full_pipeline_pauses_at_gate_then_resumes_to_ready_for_ae(tmp_path: Path) -> None:
    take = _make_av_clip(tmp_path / "source.mp4")
    library_path = _make_music_library(tmp_path)

    mgr = JobManager(jobs_root=tmp_path / "jobs")

    def _fake_build_pipeline_stages():
        return build_pipeline_stages(
            _gemini_client=_fresh_gemini_client(),
            _aligner=_fake_aligner,
            _beat_detector=_fake_beat_detector,
            _library_path=library_path,
        )

    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", _key_safe_settings)
        mp.setattr("app.main.build_pipeline_stages", _fake_build_pipeline_stages)
        app.state.job_manager = mgr

        with TestClient(app) as client:
            # 1. POST /jobs — returns immediately with a job_id.
            resp = client.post(
                "/jobs",
                json={
                    "video_path": str(take),
                    "brand_kit": "kitA",
                    "brief": "cozy coffee promo",
                    "client_asset_paths": [],
                },
            )
            assert resp.status_code == 200, resp.text
            job_id = resp.json()["job_id"]
            assert job_id

            # 2. The pipeline ran ingest -> audio -> asr -> gate synchronously
            #    (TestClient runs BackgroundTasks before returning — D-028) and
            #    is now paused awaiting correction.
            status_resp = client.get(f"/jobs/{job_id}/status")
            assert status_resp.status_code == 200
            status = status_resp.json()
            assert status["state"] == "awaiting_correction", status

            # 3. GET the raw transcript, then confirm it as-is via POST (operator
            #    round-trip — the same pattern test_correction_gate.py exercises).
            raw = client.get(f"/jobs/{job_id}/transcript")
            assert raw.status_code == 200
            transcript = raw.json()
            assert len(transcript["segments"]) == 2

            post_resp = client.post(f"/jobs/{job_id}/transcript", json=transcript)
            assert post_resp.status_code == 200, post_resp.text

            # 4. Resume ran align -> understand -> music -> plan_visuals ->
            #    images -> assemble_plan synchronously; the job should now be
            #    fully complete.
            final_status = client.get(f"/jobs/{job_id}/status").json()
            assert final_status["state"] == "ready_for_ae", final_status
            assert final_status["progress_pct"] == 100.0

            # 5. GET /jobs/{id}/edit_plan serves the assembled plan.
            plan_resp = client.get(f"/jobs/{job_id}/edit_plan")
            assert plan_resp.status_code == 200, plan_resp.text
            plan_dict = plan_resp.json()

    # 6. The plan on disk is a fully valid, asset-checked EditPlan.
    job_dir = tmp_path / "jobs" / job_id
    edit_plan_path = job_dir / "edit_plan.json"
    assert edit_plan_path.exists()

    plan = EditPlan.model_validate(plan_dict)
    validate_edit_plan(
        plan,
        known_templates=V1_TEMPLATE_NAMES,
        check_assets=True,
        job_dir=job_dir,
    )

    # Sanity: captions cover both segments' words; at least one generated
    # image visual was produced from the "show product packaging" segment.
    assert len(plan.captions) == 2
    assert any(v.kind == "generated_image" for v in plan.visuals)


@skip_no_fftools
def test_edit_plan_404_before_ready_and_status_404_for_unknown_job(tmp_path: Path) -> None:
    mgr = JobManager(jobs_root=tmp_path / "jobs")
    app.state.job_manager = mgr
    client = TestClient(app)

    # Unknown job entirely.
    assert client.get("/jobs/does-not-exist/status").status_code == 404
    assert client.get("/jobs/does-not-exist/edit_plan").status_code == 404
    assert client.get("/jobs/does-not-exist/build_report").status_code == 404
    assert client.post("/jobs/does-not-exist/cancel").status_code == 404

    # A freshly created job (still running) has no edit_plan yet.
    job = mgr.create("kitA", "brief")
    resp = client.get(f"/jobs/{job.job_id}/edit_plan")
    assert resp.status_code == 404
    assert "not ready" in resp.json()["detail"].lower() or "ready_for_ae" in resp.json()["detail"]


def test_brand_kits_stub_returns_empty_list() -> None:
    client = TestClient(app)
    resp = client.get("/brand_kits")
    assert resp.status_code == 200
    assert resp.json() == []


def test_post_jobs_returns_promptly_with_job_id(tmp_path: Path) -> None:
    """POST /jobs must not require ingest/asr to succeed just to return a job_id.

    Uses a nonexistent video_path so ingest fails fast; the point is only that
    the endpoint itself returns {job_id} immediately regardless of downstream
    pipeline outcome (the pipeline runs in the background).
    """
    mgr = JobManager(jobs_root=tmp_path / "jobs")
    app.state.job_manager = mgr
    client = TestClient(app)

    resp = client.post(
        "/jobs",
        json={
            "video_path": str(tmp_path / "does-not-exist.mp4"),
            "brand_kit": "kitA",
            "brief": "",
            "client_asset_paths": [],
        },
    )
    assert resp.status_code == 200
    job_id = resp.json()["job_id"]
    assert job_id

    # The (synchronously-run-in-TestClient) background pipeline should have
    # failed cleanly at ingest, not crashed the request.
    status = client.get(f"/jobs/{job_id}/status").json()
    assert status["state"] == "error"


def test_cancel_running_job_then_idempotent_on_terminal(tmp_path: Path) -> None:
    mgr = JobManager(jobs_root=tmp_path / "jobs")
    app.state.job_manager = mgr
    client = TestClient(app)

    job = mgr.create("kitA", "brief")  # stays in the initial RUNNING/"created" status

    resp = client.post(f"/jobs/{job.job_id}/cancel")
    assert resp.status_code == 200
    body = resp.json()
    assert body["state"] == "error"

    status = client.get(f"/jobs/{job.job_id}/status").json()
    assert status["state"] == "error"

    # Idempotent: cancelling an already-terminal job is a clean no-op.
    resp2 = client.post(f"/jobs/{job.job_id}/cancel")
    assert resp2.status_code == 200
    assert resp2.json()["state"] == "error"


def test_build_report_post_then_get(tmp_path: Path) -> None:
    mgr = JobManager(jobs_root=tmp_path / "jobs")
    app.state.job_manager = mgr
    client = TestClient(app)

    job = mgr.create("kitA", "brief")

    assert client.get(f"/jobs/{job.job_id}/build_report").status_code == 404

    report = {"ok": True, "layers_missing": [], "notes": "test report"}
    post_resp = client.post(f"/jobs/{job.job_id}/build_report", json=report)
    assert post_resp.status_code == 200

    get_resp = client.get(f"/jobs/{job.job_id}/build_report")
    assert get_resp.status_code == 200
    assert get_resp.json() == report
