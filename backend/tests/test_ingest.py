"""Tests for the ingest pipeline stage (T-102).

Synthesizes tiny lavfi color video samples with ffmpeg at test setup so no
binary media is committed to the repo. Tests are skipped (not failed) when
ffmpeg/ffprobe is unavailable in the environment.
"""

from __future__ import annotations

import asyncio
import json
import shutil
import subprocess
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from app.jobs.manager import JobManager, Stage
from app.pipeline.ingest import (
    _effective_wh,
    _parse_fps,
    run_ingest,
)

# ---------------------------------------------------------------------------
# Environment guard
# ---------------------------------------------------------------------------

_HAS_FFMPEG = bool(shutil.which("ffmpeg"))
_HAS_FFPROBE = bool(shutil.which("ffprobe"))
_HAS_FFTOOLS = _HAS_FFMPEG and _HAS_FFPROBE

skip_no_fftools = pytest.mark.skipif(
    not _HAS_FFTOOLS,
    reason="ffmpeg/ffprobe not available in this environment",
)

# ---------------------------------------------------------------------------
# Video synthesis helper
# ---------------------------------------------------------------------------


def _make_video(
    path: Path,
    width: int,
    height: int,
    duration: float = 2.0,
    fps: int = 30,
) -> Path:
    """Synthesise a tiny lavfi color video using ffmpeg."""
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-f", "lavfi",
            "-i", f"color=c=blue:s={width}x{height}:r={fps}",
            "-t", str(duration),
            "-pix_fmt", "yuv420p",
            str(path),
        ],
        check=True,
    )
    return path


# ---------------------------------------------------------------------------
# Unit tests (no ffmpeg required)
# ---------------------------------------------------------------------------


def test_parse_fps_fraction() -> None:
    assert _parse_fps("30/1") == pytest.approx(30.0)
    assert _parse_fps("30000/1001") == pytest.approx(29.97, rel=1e-3)
    assert _parse_fps("24/1") == pytest.approx(24.0)


def test_parse_fps_integer_string() -> None:
    assert _parse_fps("25") == pytest.approx(25.0)


def test_effective_wh_no_rotation() -> None:
    stream = {"width": 1080, "height": 1920}
    assert _effective_wh(stream) == (1080, 1920)


def test_effective_wh_rotation_90() -> None:
    """A 1920×1080 stream tagged rotate=90 is treated as 1080×1920."""
    stream = {"width": 1920, "height": 1080, "tags": {"rotate": "90"}}
    assert _effective_wh(stream) == (1080, 1920)


def test_effective_wh_rotation_270() -> None:
    stream = {"width": 1920, "height": 1080, "tags": {"rotate": "270"}}
    assert _effective_wh(stream) == (1080, 1920)


def test_effective_wh_rotation_180() -> None:
    """180° rotation does NOT swap dimensions."""
    stream = {"width": 1920, "height": 1080, "tags": {"rotate": "180"}}
    assert _effective_wh(stream) == (1920, 1080)


def test_effective_wh_side_data_list() -> None:
    """side_data_list rotation takes precedence over tags.rotate."""
    stream = {
        "width": 1920, "height": 1080,
        "side_data_list": [{"rotation": -90}],
        "tags": {"rotate": "0"},
    }
    # -90 % 360 == 270 → swap
    assert _effective_wh(stream) == (1080, 1920)


# ---------------------------------------------------------------------------
# Missing source file (no ffmpeg required — fails before probing)
# ---------------------------------------------------------------------------


def test_missing_source_file_error(tmp_path: Path) -> None:
    """A missing source file produces a clear IngestError before probing."""
    mgr = JobManager(jobs_root=tmp_path / "jobs")
    job = mgr.create(
        "kitA", "brief",
        source_path=str(tmp_path / "does_not_exist.mp4"),
    )
    stage = Stage(name="ingest", run=run_ingest)
    asyncio.run(mgr.run_pipeline(job.job_id, [stage]))

    status = mgr.status(job.job_id)
    assert status.state.value == "error"
    assert "not found" in status.message.lower()
    assert "does_not_exist.mp4" in status.message


def test_no_source_path_set_error(tmp_path: Path) -> None:
    """A job created with no source_path produces a clear error."""
    mgr = JobManager(jobs_root=tmp_path / "jobs")
    job = mgr.create("kitA", "brief")  # no source_path
    stage = Stage(name="ingest", run=run_ingest)
    asyncio.run(mgr.run_pipeline(job.job_id, [stage]))

    status = mgr.status(job.job_id)
    assert status.state.value == "error"
    assert "source_path" in status.message


# ---------------------------------------------------------------------------
# ffprobe failure (mocked)
# ---------------------------------------------------------------------------


def test_ffprobe_nonzero_exit_surfaces_clear_error(tmp_path: Path) -> None:
    """ffprobe non-zero exit produces an IngestError, not a raw exception."""
    fake_video = tmp_path / "fake.mp4"
    fake_video.write_bytes(b"not a real video file")

    mgr = JobManager(jobs_root=tmp_path / "jobs")
    job = mgr.create("kitA", "brief", source_path=str(fake_video))

    mock_proc = MagicMock()
    mock_proc.returncode = 1
    mock_proc.stderr = "Invalid data found when processing input"
    mock_proc.stdout = ""

    with patch("app.clients.ffmpeg.subprocess.run", return_value=mock_proc):
        stage = Stage(name="ingest", run=run_ingest)
        asyncio.run(mgr.run_pipeline(job.job_id, [stage]))

    status = mgr.status(job.job_id)
    assert status.state.value == "error"
    assert "ffprobe" in status.message.lower()
    assert "1" in status.message  # exit code present


def test_ffprobe_not_found_surfaces_clear_error(tmp_path: Path) -> None:
    """FileNotFoundError from ffprobe produces a helpful IngestError."""
    fake_video = tmp_path / "fake.mp4"
    fake_video.write_bytes(b"not real")

    mgr = JobManager(jobs_root=tmp_path / "jobs")
    job = mgr.create("kitA", "brief", source_path=str(fake_video))

    with patch("app.clients.ffmpeg.subprocess.run", side_effect=FileNotFoundError):
        stage = Stage(name="ingest", run=run_ingest)
        asyncio.run(mgr.run_pipeline(job.job_id, [stage]))

    status = mgr.status(job.job_id)
    assert status.state.value == "error"
    assert "ffprobe" in status.message.lower()


def test_ffprobe_invalid_json_surfaces_clear_error(tmp_path: Path) -> None:
    """Invalid JSON from ffprobe produces a clear IngestError."""
    fake_video = tmp_path / "fake.mp4"
    fake_video.write_bytes(b"not real")

    mgr = JobManager(jobs_root=tmp_path / "jobs")
    job = mgr.create("kitA", "brief", source_path=str(fake_video))

    mock_proc = MagicMock()
    mock_proc.returncode = 0
    mock_proc.stderr = ""
    mock_proc.stdout = "this is not json {"

    with patch("app.clients.ffmpeg.subprocess.run", return_value=mock_proc):
        stage = Stage(name="ingest", run=run_ingest)
        asyncio.run(mgr.run_pipeline(job.job_id, [stage]))

    status = mgr.status(job.job_id)
    assert status.state.value == "error"
    assert "json" in status.message.lower()


# ---------------------------------------------------------------------------
# Integration tests (require ffmpeg/ffprobe)
# ---------------------------------------------------------------------------


@skip_no_fftools
def test_valid_9x16_ingest_records_metadata(tmp_path: Path) -> None:
    """Valid 1080×1920 take ingests; ctx.job and job.json are updated correctly."""
    take = _make_video(tmp_path / "source.mp4", 1080, 1920)

    mgr = JobManager(jobs_root=tmp_path / "jobs")
    job = mgr.create("kitA", "brief", source_path=str(take))
    stage = Stage(name="ingest", run=run_ingest)
    asyncio.run(mgr.run_pipeline(job.job_id, [stage]))

    status = mgr.status(job.job_id)
    assert status.state.value == "ready_for_ae", status.message

    job_after = mgr.get_job(job.job_id)
    assert job_after.width == 1080
    assert job_after.height == 1920
    assert job_after.fps == 30
    assert job_after.duration is not None
    assert 1.5 <= job_after.duration <= 3.0

    # Verify job.json on disk is updated
    job_json = json.loads(
        (tmp_path / "jobs" / job.job_id / "job.json").read_text(encoding="utf-8")
    )
    assert job_json["width"] == 1080
    assert job_json["height"] == 1920
    assert job_json["fps"] == 30


@skip_no_fftools
def test_take_copied_to_canonical_location(tmp_path: Path) -> None:
    """The source take is copied to job_dir/input.mp4."""
    take = _make_video(tmp_path / "source.mp4", 1080, 1920)

    mgr = JobManager(jobs_root=tmp_path / "jobs")
    job = mgr.create("kitA", "brief", source_path=str(take))
    asyncio.run(mgr.run_pipeline(job.job_id, [Stage(name="ingest", run=run_ingest)]))

    canonical = tmp_path / "jobs" / job.job_id / "input.mp4"
    assert canonical.exists(), "input.mp4 must exist at job_dir/input.mp4"
    assert canonical.stat().st_size > 0


@skip_no_fftools
def test_client_assets_copied_into_client_dir(tmp_path: Path) -> None:
    """Client assets land in assets/client/ inside the job workspace."""
    take = _make_video(tmp_path / "source.mp4", 1080, 1920)
    logo = tmp_path / "logo.png"
    logo.write_bytes(b"fake-png-bytes")
    watermark = tmp_path / "watermark.png"
    watermark.write_bytes(b"another-fake-png")

    mgr = JobManager(jobs_root=tmp_path / "jobs")
    job = mgr.create(
        "kitA", "brief",
        source_path=str(take),
        client_asset_paths=[str(logo), str(watermark)],
    )
    asyncio.run(mgr.run_pipeline(job.job_id, [Stage(name="ingest", run=run_ingest)]))

    client_dir = tmp_path / "jobs" / job.job_id / "assets" / "client"
    assert (client_dir / "logo.png").exists()
    assert (client_dir / "watermark.png").exists()


@skip_no_fftools
def test_16x9_rejected_with_helpful_message(tmp_path: Path) -> None:
    """A 1920×1080 (16:9) take is rejected; job ends in error with a clear message."""
    take = _make_video(tmp_path / "landscape.mp4", 1920, 1080)

    mgr = JobManager(jobs_root=tmp_path / "jobs")
    job = mgr.create("kitA", "brief", source_path=str(take))
    asyncio.run(mgr.run_pipeline(job.job_id, [Stage(name="ingest", run=run_ingest)]))

    status = mgr.status(job.job_id)
    assert status.state.value == "error"
    assert "9:16" in status.message
    # Dimensions are present in the message so the operator knows what was found
    assert "1920" in status.message and "1080" in status.message


@skip_no_fftools
def test_16x9_rejection_does_not_write_input_mp4(tmp_path: Path) -> None:
    """input.mp4 is not written when the take is rejected."""
    take = _make_video(tmp_path / "landscape.mp4", 1920, 1080)

    mgr = JobManager(jobs_root=tmp_path / "jobs")
    job = mgr.create("kitA", "brief", source_path=str(take))
    asyncio.run(mgr.run_pipeline(job.job_id, [Stage(name="ingest", run=run_ingest)]))

    canonical = tmp_path / "jobs" / job.job_id / "input.mp4"
    assert not canonical.exists(), "input.mp4 must NOT be written for a rejected take"


@skip_no_fftools
def test_valid_720x1280_accepted(tmp_path: Path) -> None:
    """720×1280 (9:16) is within tolerance and accepted."""
    take = _make_video(tmp_path / "source_720.mp4", 720, 1280)

    mgr = JobManager(jobs_root=tmp_path / "jobs")
    job = mgr.create("kitA", "brief", source_path=str(take))
    asyncio.run(mgr.run_pipeline(job.job_id, [Stage(name="ingest", run=run_ingest)]))

    assert mgr.status(job.job_id).state.value == "ready_for_ae"
    assert mgr.get_job(job.job_id).width == 720
    assert mgr.get_job(job.job_id).height == 1280


@skip_no_fftools
def test_through_runner_success_state_is_ready_for_ae(tmp_path: Path) -> None:
    """Ingest wired into the T-101 runner advances status to READY_FOR_AE on success."""
    take = _make_video(tmp_path / "take.mp4", 1080, 1920)

    mgr = JobManager(jobs_root=tmp_path / "jobs")
    job = mgr.create("kitA", "brief", source_path=str(take))
    asyncio.run(mgr.run_pipeline(job.job_id, [Stage(name="ingest", run=run_ingest)]))

    assert mgr.status(job.job_id).state.value == "ready_for_ae"
    assert mgr.status(job.job_id).progress_pct == 100.0


@skip_no_fftools
def test_through_runner_rejection_state_is_error(tmp_path: Path) -> None:
    """Ingest wired into the T-101 runner sets state=error on a 16:9 rejection."""
    take = _make_video(tmp_path / "landscape.mp4", 1920, 1080)

    mgr = JobManager(jobs_root=tmp_path / "jobs")
    job = mgr.create("kitA", "brief", source_path=str(take))
    asyncio.run(mgr.run_pipeline(job.job_id, [Stage(name="ingest", run=run_ingest)]))

    status = mgr.status(job.job_id)
    assert status.state.value == "error"
    assert status.message  # non-empty human-readable message
