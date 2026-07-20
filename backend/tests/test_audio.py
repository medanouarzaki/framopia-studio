"""Tests for the audio-extraction pipeline stage (T-103).

Synthesizes tiny av sample clips with ffmpeg at test setup — no binary media
committed. Tests are skipped (not failed) when ffmpeg/ffprobe is unavailable.
"""

from __future__ import annotations

import asyncio
import shutil
import subprocess
import wave
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from app.clients.ffmpeg import FfmpegError
from app.jobs.manager import JobManager, Stage
from app.pipeline.audio import AudioError, run_audio

# ---------------------------------------------------------------------------
# Environment guard
# ---------------------------------------------------------------------------

_HAS_FFTOOLS = bool(shutil.which("ffmpeg")) and bool(shutil.which("ffprobe"))

skip_no_fftools = pytest.mark.skipif(
    not _HAS_FFTOOLS,
    reason="ffmpeg/ffprobe not available in this environment",
)

# ---------------------------------------------------------------------------
# Synthesis helpers
# ---------------------------------------------------------------------------


def _make_av_clip(path: Path, duration: float = 2.0) -> Path:
    """Synthesise a 1080×1920 mp4 with both video and audio tracks."""
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


def _make_video_only_clip(path: Path, duration: float = 2.0) -> Path:
    """Synthesise a 1080×1920 mp4 with NO audio stream."""
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-f", "lavfi", "-i", "color=c=red:s=1080x1920:r=30",
            "-t", str(duration),
            "-an",
            "-pix_fmt", "yuv420p",
            str(path),
        ],
        check=True,
    )
    return path


def _place_input_mp4(tmp_path: Path, jobs_root: Path, job_id: str, src: Path) -> Path:
    """Copy *src* to the canonical input.mp4 location for the given job."""
    dest = jobs_root / job_id / "input.mp4"
    shutil.copy2(src, dest)
    return dest


# ---------------------------------------------------------------------------
# Unit test: FfmpegError is a RuntimeError (runner catches Exception)
# ---------------------------------------------------------------------------


def test_ffmpeg_error_is_runtime_error() -> None:
    assert issubclass(FfmpegError, RuntimeError)


def test_audio_error_is_runtime_error() -> None:
    assert issubclass(AudioError, RuntimeError)


# ---------------------------------------------------------------------------
# Missing input.mp4 (no fftools required)
# ---------------------------------------------------------------------------


def test_missing_input_mp4(tmp_path: Path) -> None:
    """Missing input.mp4 produces a clear error before any ffmpeg call."""
    jobs_root = tmp_path / "jobs"
    mgr = JobManager(jobs_root=jobs_root)
    job = mgr.create("kitA", "brief")
    # Do NOT place input.mp4 — it's absent

    stage = Stage(name="audio", run=run_audio)
    asyncio.run(mgr.run_pipeline(job.job_id, [stage]))

    status = mgr.status(job.job_id)
    assert status.state.value == "error"
    assert "input.mp4" in status.message
    assert "not found" in status.message.lower()


# ---------------------------------------------------------------------------
# ffprobe / ffmpeg failures (mocked — no fftools required)
# ---------------------------------------------------------------------------


def test_ffprobe_failure_in_audio_stage(tmp_path: Path) -> None:
    """A ffprobe error inside the audio stage surfaces as a clear AudioError."""
    jobs_root = tmp_path / "jobs"
    mgr = JobManager(jobs_root=jobs_root)
    job = mgr.create("kitA", "brief")
    # Place a dummy input.mp4 so the existence check passes
    (jobs_root / job.job_id / "input.mp4").write_bytes(b"not a real video")

    with patch("app.clients.ffmpeg.subprocess.run", side_effect=FileNotFoundError):
        stage = Stage(name="audio", run=run_audio)
        asyncio.run(mgr.run_pipeline(job.job_id, [stage]))

    status = mgr.status(job.job_id)
    assert status.state.value == "error"
    assert "ffprobe" in status.message.lower()


def test_ffmpeg_extract_nonzero_exit(tmp_path: Path) -> None:
    """ffmpeg non-zero exit during extraction surfaces a clear human-readable error."""
    jobs_root = tmp_path / "jobs"
    mgr = JobManager(jobs_root=jobs_root)
    job = mgr.create("kitA", "brief")
    (jobs_root / job.job_id / "input.mp4").write_bytes(b"not real")

    # First call (ffprobe probe) must succeed and report an audio stream.
    # Second call (ffmpeg extract) returns a non-zero exit.
    probe_result = MagicMock()
    probe_result.returncode = 0
    probe_result.stderr = ""
    probe_result.stdout = (
        '{"streams": [{"codec_type": "audio"}], "format": {"duration": "2.0"}}'
    )

    extract_result = MagicMock()
    extract_result.returncode = 1
    extract_result.stderr = "Conversion failed!"
    extract_result.stdout = ""

    with patch(
        "app.clients.ffmpeg.subprocess.run",
        side_effect=[probe_result, extract_result],
    ):
        stage = Stage(name="audio", run=run_audio)
        asyncio.run(mgr.run_pipeline(job.job_id, [stage]))

    status = mgr.status(job.job_id)
    assert status.state.value == "error"
    assert "ffmpeg" in status.message.lower()
    assert "1" in status.message  # exit code


def test_ffmpeg_not_found_during_extract(tmp_path: Path) -> None:
    """FileNotFoundError from ffmpeg during extraction gives a clear message."""
    jobs_root = tmp_path / "jobs"
    mgr = JobManager(jobs_root=jobs_root)
    job = mgr.create("kitA", "brief")
    (jobs_root / job.job_id / "input.mp4").write_bytes(b"not real")

    probe_result = MagicMock()
    probe_result.returncode = 0
    probe_result.stderr = ""
    probe_result.stdout = (
        '{"streams": [{"codec_type": "audio"}], "format": {"duration": "2.0"}}'
    )

    with patch(
        "app.clients.ffmpeg.subprocess.run",
        side_effect=[probe_result, FileNotFoundError],
    ):
        stage = Stage(name="audio", run=run_audio)
        asyncio.run(mgr.run_pipeline(job.job_id, [stage]))

    status = mgr.status(job.job_id)
    assert status.state.value == "error"
    assert "ffmpeg" in status.message.lower()


# ---------------------------------------------------------------------------
# No audio stream (mocked)
# ---------------------------------------------------------------------------


def test_no_audio_stream_mocked(tmp_path: Path) -> None:
    """A probe result with no audio stream produces a clear AudioError (no silent wav)."""
    jobs_root = tmp_path / "jobs"
    mgr = JobManager(jobs_root=jobs_root)
    job = mgr.create("kitA", "brief")
    (jobs_root / job.job_id / "input.mp4").write_bytes(b"not real")

    probe_result = MagicMock()
    probe_result.returncode = 0
    probe_result.stderr = ""
    probe_result.stdout = (
        '{"streams": [{"codec_type": "video"}], "format": {"duration": "2.0"}}'
    )

    with patch("app.clients.ffmpeg.subprocess.run", return_value=probe_result):
        stage = Stage(name="audio", run=run_audio)
        asyncio.run(mgr.run_pipeline(job.job_id, [stage]))

    status = mgr.status(job.job_id)
    assert status.state.value == "error"
    assert "audio" in status.message.lower() or "speech" in status.message.lower()
    # Crucially: audio.wav must NOT exist (no silent empty file written)
    audio_wav = jobs_root / job.job_id / "audio.wav"
    assert not audio_wav.exists()


# ---------------------------------------------------------------------------
# Integration tests (require ffmpeg/ffprobe)
# ---------------------------------------------------------------------------


@skip_no_fftools
def test_audio_extraction_produces_16khz_mono_wav(tmp_path: Path) -> None:
    """Valid AV take → audio.wav that is 16 kHz mono PCM (verified via wave module)."""
    clip = _make_av_clip(tmp_path / "take.mp4")

    jobs_root = tmp_path / "jobs"
    mgr = JobManager(jobs_root=jobs_root)
    job = mgr.create("kitA", "brief")
    _place_input_mp4(tmp_path, jobs_root, job.job_id, clip)

    stage = Stage(name="audio", run=run_audio)
    asyncio.run(mgr.run_pipeline(job.job_id, [stage]))

    status = mgr.status(job.job_id)
    assert status.state.value == "ready_for_ae", status.message

    audio_wav = jobs_root / job.job_id / "audio.wav"
    assert audio_wav.exists()
    assert audio_wav.stat().st_size > 0

    with wave.open(str(audio_wav)) as wf:
        assert wf.getframerate() == 16000
        assert wf.getnchannels() == 1
        assert wf.getsampwidth() == 2  # pcm_s16le = 2 bytes per sample


@skip_no_fftools
def test_audio_wav_at_job_root_not_assets_audio(tmp_path: Path) -> None:
    """audio.wav is written to job_dir/audio.wav, NOT to assets/audio/."""
    clip = _make_av_clip(tmp_path / "take.mp4")

    jobs_root = tmp_path / "jobs"
    mgr = JobManager(jobs_root=jobs_root)
    job = mgr.create("kitA", "brief")
    _place_input_mp4(tmp_path, jobs_root, job.job_id, clip)

    asyncio.run(mgr.run_pipeline(job.job_id, [Stage(name="audio", run=run_audio)]))

    job_dir = jobs_root / job.job_id
    assert (job_dir / "audio.wav").exists(), "audio.wav must be at job root"
    assert not (job_dir / "assets" / "audio" / "audio.wav").exists(), (
        "audio.wav must NOT be placed inside assets/audio/"
    )


@skip_no_fftools
def test_no_audio_stream_real_video(tmp_path: Path) -> None:
    """A real video-only clip (no audio stream) produces a clear AudioError."""
    clip = _make_video_only_clip(tmp_path / "take_no_audio.mp4")

    jobs_root = tmp_path / "jobs"
    mgr = JobManager(jobs_root=jobs_root)
    job = mgr.create("kitA", "brief")
    _place_input_mp4(tmp_path, jobs_root, job.job_id, clip)

    asyncio.run(mgr.run_pipeline(job.job_id, [Stage(name="audio", run=run_audio)]))

    status = mgr.status(job.job_id)
    assert status.state.value == "error"
    assert "audio" in status.message.lower() or "speech" in status.message.lower()
    # No audio.wav should have been written
    assert not (jobs_root / job.job_id / "audio.wav").exists()


@skip_no_fftools
def test_through_runner_success_state(tmp_path: Path) -> None:
    """Audio stage wired into T-101 runner → READY_FOR_AE + progress 100% on success."""
    clip = _make_av_clip(tmp_path / "take.mp4")

    jobs_root = tmp_path / "jobs"
    mgr = JobManager(jobs_root=jobs_root)
    job = mgr.create("kitA", "brief")
    _place_input_mp4(tmp_path, jobs_root, job.job_id, clip)

    asyncio.run(mgr.run_pipeline(job.job_id, [Stage(name="audio", run=run_audio)]))

    status = mgr.status(job.job_id)
    assert status.state.value == "ready_for_ae"
    assert status.progress_pct == 100.0


@skip_no_fftools
def test_through_runner_no_audio_stream_error_state(tmp_path: Path) -> None:
    """Audio stage with a video-only input → runner state=error with message."""
    clip = _make_video_only_clip(tmp_path / "no_audio.mp4")

    jobs_root = tmp_path / "jobs"
    mgr = JobManager(jobs_root=jobs_root)
    job = mgr.create("kitA", "brief")
    _place_input_mp4(tmp_path, jobs_root, job.job_id, clip)

    asyncio.run(mgr.run_pipeline(job.job_id, [Stage(name="audio", run=run_audio)]))

    status = mgr.status(job.job_id)
    assert status.state.value == "error"
    assert status.message  # non-empty human-readable message
