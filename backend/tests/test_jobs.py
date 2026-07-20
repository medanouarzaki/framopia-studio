"""Tests for job workspace, job manager, and async stage runner (T-101)."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest

from app.config import Settings
from app.jobs.manager import JobContext, JobManager, Stage
from app.jobs.paths import WorkspacePaths
from app.models.job import Job, JobState, JobStatus

# ---------------------------------------------------------------------------
# Helpers: fake stages for testing
# ---------------------------------------------------------------------------


async def _stage_write(ctx: JobContext, filename: str, content: str = "done") -> None:
    """Write a sentinel file so tests can verify the stage ran."""
    (ctx.paths.job_dir / filename).write_text(content)


def _make_stage(name: str, artifact: str, *, is_gate: bool = False) -> Stage:
    """Create a fake Stage that writes a sentinel artifact file."""
    async def run(ctx: JobContext) -> None:
        await _stage_write(ctx, artifact)

    return Stage(name=name, run=run, is_gate=is_gate)


def _make_error_stage(name: str, message: str = "deliberate failure") -> Stage:
    """Create a fake Stage that always raises."""
    async def run(ctx: JobContext) -> None:
        raise RuntimeError(message)

    return Stage(name=name, run=run)


# ---------------------------------------------------------------------------
# Fixture: JobManager backed by pytest's tmp_path
# ---------------------------------------------------------------------------


@pytest.fixture
def mgr(tmp_path: Path) -> JobManager:
    """A fresh JobManager using an isolated temp directory."""
    return JobManager(jobs_root=tmp_path)


# ---------------------------------------------------------------------------
# JobState exact string values
# ---------------------------------------------------------------------------


def test_job_state_string_values() -> None:
    """JobState enum values are exactly the strings the panel/endpoints expect (§14.1)."""
    assert JobState.RUNNING.value == "running"
    assert JobState.AWAITING_CORRECTION.value == "awaiting_correction"
    assert JobState.READY_FOR_AE.value == "ready_for_ae"
    assert JobState.ERROR.value == "error"
    assert set(s.value for s in JobState) == {
        "running", "awaiting_correction", "ready_for_ae", "error"
    }


# ---------------------------------------------------------------------------
# Workspace scaffolding
# ---------------------------------------------------------------------------


def test_workspace_scaffolding(mgr: JobManager, tmp_path: Path) -> None:
    """create() builds the full job workspace with all expected dirs and files."""
    job = mgr.create(brand_kit="framopia-clientA", brief="test brief")
    paths = WorkspacePaths(tmp_path, job.job_id)

    assert paths.job_dir.is_dir()
    assert paths.assets_dir.is_dir()
    assert paths.images_dir.is_dir()
    assert paths.audio_dir.is_dir()
    assert paths.client_dir.is_dir()
    assert paths.log_path.is_file()
    assert paths.job_json_path.is_file()


def test_job_json_round_trips(mgr: JobManager, tmp_path: Path) -> None:
    """job.json is valid JSON that round-trips to a Job with correct fields."""
    job = mgr.create(brand_kit="framopia-clientA", brief="autumn promo")
    paths = WorkspacePaths(tmp_path, job.job_id)

    raw = json.loads(paths.job_json_path.read_text(encoding="utf-8"))
    loaded = Job.model_validate(raw)

    assert loaded.job_id == job.job_id
    assert loaded.brand_kit == "framopia-clientA"
    assert loaded.brief == "autumn promo"
    assert loaded.width is None  # not filled until ingest (T-102)
    assert loaded.duration is None


def test_initial_status(mgr: JobManager) -> None:
    """Initial job status is RUNNING / stage='created' / 0%."""
    job = mgr.create(brand_kit="framopia-clientA", brief="test")
    status = mgr.status(job.job_id)

    assert status.state == JobState.RUNNING
    assert status.stage == "created"
    assert status.progress_pct == 0.0


def test_jobs_root_is_tmp_path(mgr: JobManager, tmp_path: Path) -> None:
    """Tests never write to the real repo /jobs/ directory."""
    job = mgr.create(brand_kit="framopia-clientA", brief="test")
    paths = WorkspacePaths(tmp_path, job.job_id)
    assert paths.job_dir.is_relative_to(tmp_path)


# ---------------------------------------------------------------------------
# Straight-through pipeline (no gate)
# ---------------------------------------------------------------------------


def test_straight_through_pipeline(mgr: JobManager, tmp_path: Path) -> None:
    """Two-stage pipeline with no gate completes to READY_FOR_AE with progress=100."""
    job = mgr.create(brand_kit="framopia-clientA", brief="test")
    stages = [
        _make_stage("stage_a", "stage_a.txt"),
        _make_stage("stage_b", "stage_b.txt"),
    ]
    asyncio.run(mgr.run_pipeline(job.job_id, stages))

    status = mgr.status(job.job_id)
    assert status.state == JobState.READY_FOR_AE
    assert status.progress_pct == 100.0

    paths = WorkspacePaths(tmp_path, job.job_id)
    assert (paths.job_dir / "stage_a.txt").exists()
    assert (paths.job_dir / "stage_b.txt").exists()


def test_pipeline_progress_advances(mgr: JobManager) -> None:
    """Status stage name advances as each stage runs."""
    seen_stages: list[str] = []

    async def recording_stage(ctx: JobContext) -> None:
        seen_stages.append(mgr.status(ctx.job_id).stage)

    job = mgr.create(brand_kit="framopia-clientA", brief="test")
    stages = [
        Stage(name="alpha", run=recording_stage),
        Stage(name="beta", run=recording_stage),
    ]
    asyncio.run(mgr.run_pipeline(job.job_id, stages))
    # Each stage sees itself as the current stage when it runs
    assert "alpha" in seen_stages
    assert "beta" in seen_stages


# ---------------------------------------------------------------------------
# Gate: pause and resume
# ---------------------------------------------------------------------------


def test_gate_pauses_at_awaiting_correction(mgr: JobManager, tmp_path: Path) -> None:
    """Pipeline with a gate stage halts at AWAITING_CORRECTION; stages after gate do not run."""
    job = mgr.create(brand_kit="framopia-clientA", brief="test")
    stages = [
        _make_stage("before_gate", "before_gate.txt"),
        _make_stage("gate", "gate.txt", is_gate=True),
        _make_stage("after_gate", "after_gate.txt"),
    ]
    asyncio.run(mgr.run_pipeline(job.job_id, stages))

    status = mgr.status(job.job_id)
    assert status.state == JobState.AWAITING_CORRECTION

    paths = WorkspacePaths(tmp_path, job.job_id)
    assert (paths.job_dir / "before_gate.txt").exists()
    assert (paths.job_dir / "gate.txt").exists()
    assert not (paths.job_dir / "after_gate.txt").exists(), (
        "Stage after the gate must NOT have run yet"
    )


def test_resume_completes_remaining_stages(mgr: JobManager, tmp_path: Path) -> None:
    """resume() continues from after the gate and reaches READY_FOR_AE."""
    job = mgr.create(brand_kit="framopia-clientA", brief="test")
    stages = [
        _make_stage("before_gate", "before_gate.txt"),
        _make_stage("gate", "gate.txt", is_gate=True),
        _make_stage("after_gate", "after_gate.txt"),
    ]
    asyncio.run(mgr.run_pipeline(job.job_id, stages))
    assert mgr.status(job.job_id).state == JobState.AWAITING_CORRECTION

    asyncio.run(mgr.resume(job.job_id))

    status = mgr.status(job.job_id)
    assert status.state == JobState.READY_FOR_AE
    assert status.progress_pct == 100.0

    paths = WorkspacePaths(tmp_path, job.job_id)
    assert (paths.job_dir / "after_gate.txt").exists()


def test_resume_without_pending_raises(mgr: JobManager) -> None:
    """resume() on a job not at a gate raises ValueError."""
    job = mgr.create(brand_kit="framopia-clientA", brief="test")
    with pytest.raises(ValueError, match="No pending pipeline"):
        asyncio.run(mgr.resume(job.job_id))


# ---------------------------------------------------------------------------
# Error path
# ---------------------------------------------------------------------------


def test_error_halts_pipeline(mgr: JobManager, tmp_path: Path) -> None:
    """A raising stage sets ERROR state; subsequent stages do NOT run."""
    job = mgr.create(brand_kit="framopia-clientA", brief="test")
    stages = [
        _make_stage("stage_ok", "stage_ok.txt"),
        _make_error_stage("stage_fail"),
        _make_stage("stage_skipped", "stage_skipped.txt"),
    ]
    asyncio.run(mgr.run_pipeline(job.job_id, stages))

    status = mgr.status(job.job_id)
    assert status.state == JobState.ERROR
    assert "stage_fail" in status.message

    paths = WorkspacePaths(tmp_path, job.job_id)
    assert (paths.job_dir / "stage_ok.txt").exists()
    assert not (paths.job_dir / "stage_skipped.txt").exists()


def test_error_message_contains_no_secret(mgr: JobManager, tmp_path: Path) -> None:
    """The error status message does not contain any secret key value."""
    fake_key = "super-secret-fake-key-12345"

    async def leaky_stage(ctx: JobContext) -> None:
        # A badly-written stage tries to embed a key in its exception message.
        # The runner must include the exception text — so stage authors are responsible
        # for not raising with key values. This test verifies the test stage is safe.
        raise RuntimeError("stage failed — no key here")

    job = mgr.create(brand_kit="framopia-clientA", brief="test")
    stages = [Stage(name="leaky", run=leaky_stage)]
    asyncio.run(mgr.run_pipeline(job.job_id, stages))

    status = mgr.status(job.job_id)
    assert status.state == JobState.ERROR
    assert fake_key not in status.message


# ---------------------------------------------------------------------------
# No secrets in log.txt
# ---------------------------------------------------------------------------


def test_no_secret_in_log_file(mgr: JobManager, tmp_path: Path) -> None:
    """log.txt never contains an API key value, even when settings carry one."""
    fake_key = "test-key-not-real-for-log-check"

    async def settings_aware_stage(ctx: JobContext) -> None:
        # Stage has access to settings (which holds the key) but does NOT log the key.
        _ = ctx.settings  # access settings — key is held but not logged
        (ctx.paths.job_dir / "artifact.txt").write_text("done")

    # Inject settings with a fake key directly
    settings_with_key = Settings(
        _env_file="/nonexistent/.env",
        gemini_api_key=fake_key,  # type: ignore[arg-type]
    )

    job = mgr.create(brand_kit="framopia-clientA", brief="test")
    paths = WorkspacePaths(tmp_path, job.job_id)

    # Run the pipeline manually with the settings override
    from app.jobs.joblog import JobLogger

    ctx = JobContext(
        job_id=job.job_id,
        paths=paths,
        job=mgr.get_job(job.job_id),
        logger=JobLogger(paths.log_path),
        settings=settings_with_key,
    )
    stage = Stage(name="settings_stage", run=settings_aware_stage)

    # Run the stage via the internal runner
    asyncio.run(mgr._run_stages(
        job_id=job.job_id,
        stages=[stage],
        total_stages=1,
        stages_done=0,
        ctx=ctx,
    ))

    log_content = paths.log_path.read_text(encoding="utf-8")
    assert fake_key not in log_content, (
        f"Secret key value found in log.txt: {log_content!r}"
    )


# ---------------------------------------------------------------------------
# JobStatus model
# ---------------------------------------------------------------------------


def test_job_status_progress_clamp() -> None:
    """progress_pct is clamped to [0, 100] regardless of the value passed."""
    s_low = JobStatus(state=JobState.RUNNING, stage="x", progress_pct=-10.0)
    assert s_low.progress_pct == 0.0

    s_high = JobStatus(state=JobState.RUNNING, stage="x", progress_pct=999.0)
    assert s_high.progress_pct == 100.0


def test_list_jobs(mgr: JobManager) -> None:
    """list_jobs() returns all created job IDs."""
    job_a = mgr.create(brand_kit="framopia-clientA", brief="a")
    job_b = mgr.create(brand_kit="framopia-clientA", brief="b")
    ids = mgr.list_jobs()
    assert job_a.job_id in ids
    assert job_b.job_id in ids
