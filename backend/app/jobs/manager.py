"""Job manager: workspace creation, status tracking, and async stage runner.

The stage runner is the core M1 machinery. Real pipeline stages (T-102+) plug in
as Stage objects; T-106 wires the ASR correction gate using the gate mechanism here.
"""

from __future__ import annotations

import time
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from app.config import Settings, get_settings
from app.jobs.joblog import JobLogger
from app.jobs.paths import DEFAULT_JOBS_ROOT, WorkspacePaths
from app.models.job import Job, JobState, JobStatus

# ---------------------------------------------------------------------------
# Stage and context types (public API for pipeline authors T-102+)
# ---------------------------------------------------------------------------


@dataclass
class JobContext:
    """Context passed to every pipeline stage's run() callable.

    Stages access workspace paths, the durable job record, a safe logger,
    and application settings through this object. They MUST NOT call
    ctx.settings.gemini_api_key.get_secret_value() in any logging path.
    """

    job_id: str
    paths: WorkspacePaths
    job: Job
    logger: JobLogger
    settings: Settings


@dataclass
class Stage:
    """A single named pipeline stage.

    Attributes:
        name: Human-readable stage name used in status + log.
        run:  Async callable that performs the stage's work. It receives a
              JobContext, does its computation, writes its artifact to disk,
              and returns. Any exception aborts the pipeline with state=error.
        is_gate: If True, the runner pauses after this stage in
                 'awaiting_correction' state and returns. Call
                 JobManager.resume() to continue downstream stages.
    """

    name: str
    run: Callable[[JobContext], Awaitable[None]]
    is_gate: bool = False


# ---------------------------------------------------------------------------
# Internal pipeline-continuation record
# ---------------------------------------------------------------------------


def build_pipeline_stages(
    *,
    _gemini_client: object | None = None,
    _aligner: object | None = None,
    _beat_detector: object | None = None,
    _library_path: Path | None = None,
) -> list[Stage]:
    """Build the full ordered M1 pipeline (spec Stage 1-10 / T-113).

    ingest -> audio -> asr -> correction_gate (pause) -> align -> understand ->
    music -> plan_visuals -> images -> assemble_plan

    The correction_gate is a real Stage(is_gate=True) — the runner pauses there
    in AWAITING_CORRECTION until POST /jobs/{id}/transcript calls resume().
    Because assemble_plan is last and only writes edit_plan.json on full
    success (D-047/T-112), a successful job lands at READY_FOR_AE with
    progress_pct == 100 automatically, with no special-casing needed here.

    Test seam: pass _gemini_client / _aligner / _beat_detector / _library_path
    to inject fakes into every stage that would otherwise reach out to a real
    external tool or the committed music library (asr/understand/images use
    _gemini_client; align uses _aligner; music uses _beat_detector and
    _library_path). Leave all None in production — each stage constructs its
    own real client/aligner/detector and reads the committed music/library.json.
    Imports are local to avoid a circular import with the pipeline modules,
    which import JobContext/Stage from here.
    """
    import functools

    from app.pipeline.align import run_align
    from app.pipeline.asr import run_asr
    from app.pipeline.assemble_plan import run_assemble_plan
    from app.pipeline.audio import run_audio
    from app.pipeline.correction_gate import CORRECTION_GATE_STAGE
    from app.pipeline.images import run_images
    from app.pipeline.ingest import run_ingest
    from app.pipeline.music import run_music
    from app.pipeline.plan_visuals import run_plan_visuals
    from app.pipeline.understand import run_understand

    return [
        Stage(name="ingest", run=run_ingest),
        Stage(name="audio", run=run_audio),
        Stage(name="asr", run=functools.partial(run_asr, _gemini_client=_gemini_client)),
        CORRECTION_GATE_STAGE,
        Stage(name="align", run=functools.partial(run_align, _aligner=_aligner)),
        Stage(
            name="understand",
            run=functools.partial(run_understand, _gemini_client=_gemini_client),
        ),
        Stage(
            name="music",
            run=functools.partial(
                run_music, _beat_detector=_beat_detector, _library_path=_library_path
            ),
        ),
        Stage(name="plan_visuals", run=run_plan_visuals),
        Stage(name="images", run=functools.partial(run_images, _gemini_client=_gemini_client)),
        Stage(name="assemble_plan", run=run_assemble_plan),
    ]


@dataclass
class _PipelineState:
    remaining_stages: list[Stage]
    total_stages: int
    stages_done: int
    ctx: JobContext


# ---------------------------------------------------------------------------
# Job manager
# ---------------------------------------------------------------------------


class JobManager:
    """Manages job lifecycle: workspace creation, status, and async stage execution.

    Scope note (D-013): in-memory status dicts are the source of truth for live
    state. Durable metadata lives in job.json. Cross-process-restart resume is
    OUT OF SCOPE for v1 — if the backend restarts, in-flight jobs are lost and
    must be re-submitted. Acceptable for a local, two-operator tool where restarts
    are intentional.

    Test isolation: always inject a tmp_path as jobs_root in tests so nothing
    writes to the repo's /jobs/ directory during pytest.
    """

    def __init__(self, jobs_root: Path | None = None) -> None:
        self._jobs_root: Path = jobs_root or DEFAULT_JOBS_ROOT
        self._statuses: dict[str, JobStatus] = {}
        self._jobs: dict[str, Job] = {}
        self._pending: dict[str, _PipelineState] = {}

    # ------------------------------------------------------------------
    # Job creation
    # ------------------------------------------------------------------

    def _make_job_id(self) -> str:
        """Generate a sortable, collision-safe job ID (D-012).

        Format: YYYYMMDD-HHMMSS-<6-hex-chars>
        Example: 20260720-143022-a3f9e1
        """
        ts = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
        return f"{ts}-{uuid.uuid4().hex[:6]}"

    def create(
        self,
        brand_kit: str,
        brief: str,
        source_path: str | Path | None = None,
        client_asset_paths: list[str | Path] | None = None,
    ) -> Job:
        """Create a new job workspace and register it.

        Scaffolds jobs/<id>/ with the full asset subtree, an empty log.txt,
        and job.json. Initial status is RUNNING / stage="created" / 0%.

        Args:
            brand_kit: Brand kit identifier for this job.
            brief: Operator-written brief text.
            source_path: Absolute path to the operator-supplied take (D-015).
                         Stored in job.json; read by the ingest stage at run time.
            client_asset_paths: Additional operator-supplied asset paths to copy
                                 into client_dir during ingest.

        Returns:
            The newly created Job record.
        """
        job_id = self._make_job_id()
        paths = WorkspacePaths(self._jobs_root, job_id)

        # Scaffold workspace
        paths.images_dir.mkdir(parents=True, exist_ok=True)
        paths.audio_dir.mkdir(parents=True, exist_ok=True)
        paths.client_dir.mkdir(parents=True, exist_ok=True)
        paths.log_path.touch()

        # Persist metadata
        job = Job(
            job_id=job_id,
            created_at=datetime.now(UTC).isoformat(),
            brand_kit=brand_kit,
            brief=brief,
            source_path=str(source_path) if source_path is not None else None,
            client_asset_paths=[str(p) for p in (client_asset_paths or [])],
        )
        paths.job_json_path.write_text(job.model_dump_json(indent=2), encoding="utf-8")

        self._jobs[job_id] = job
        self._statuses[job_id] = JobStatus(
            state=JobState.RUNNING,
            stage="created",
            progress_pct=0.0,
        )
        return job

    # ------------------------------------------------------------------
    # Status queries
    # ------------------------------------------------------------------

    def status(self, job_id: str) -> JobStatus:
        """Return the current live status of a job."""
        if job_id not in self._statuses:
            raise KeyError(f"Unknown job: {job_id!r}")
        return self._statuses[job_id]

    def get_job(self, job_id: str) -> Job:
        """Return the durable Job record."""
        if job_id not in self._jobs:
            raise KeyError(f"Unknown job: {job_id!r}")
        return self._jobs[job_id]

    def list_jobs(self) -> list[str]:
        """Return all registered job IDs."""
        return list(self._jobs)

    # ------------------------------------------------------------------
    # Cancellation
    # ------------------------------------------------------------------

    def cancel(self, job_id: str) -> JobStatus:
        """Cancel a job: transition it to a terminal ERROR state.

        Idempotent-safe: cancelling a job that already reached a terminal
        state (READY_FOR_AE or ERROR) is a clean no-op that returns the
        current status unchanged. A job paused at the correction gate has
        its pending continuation discarded so a stray POST /transcript can
        no longer resume it.

        Known limitation (D-013 in-memory scope): if the job is actively
        mid-stage (e.g. awaiting a Gemini call) inside an already-running
        background task, this does not interrupt that in-flight await —
        there is no task-handle tracking in v1. It DOES stop the pipeline
        from advancing to any further stage: _run_stages checks for this
        terminal state at the top of every loop iteration.
        """
        if job_id not in self._statuses:
            raise KeyError(f"Unknown job: {job_id!r}")
        current = self._statuses[job_id]
        if current.state in (JobState.READY_FOR_AE, JobState.ERROR):
            return current
        self._pending.pop(job_id, None)
        self._update_status(
            job_id,
            state=JobState.ERROR,
            message="Job cancelled by operator.",
        )
        return self._statuses[job_id]

    # ------------------------------------------------------------------
    # Internal: status mutation
    # ------------------------------------------------------------------

    def _update_status(self, job_id: str, **kwargs: object) -> None:
        current = self._statuses[job_id]
        self._statuses[job_id] = current.model_copy(update=kwargs)

    # ------------------------------------------------------------------
    # Async stage runner
    # ------------------------------------------------------------------

    async def run_pipeline(self, job_id: str, stages: list[Stage]) -> None:
        """Run a list of stages in order for the given job.

        Progress advances incrementally. If a gate stage is reached, the
        pipeline pauses in AWAITING_CORRECTION and returns; call resume()
        to continue. Any exception in a stage sets ERROR and halts.

        Artifact contract: each stage is responsible for writing its artifact
        to disk before returning. The runner does not verify this — stage-level
        tests in T-102+ assert artifact presence.
        """
        paths = WorkspacePaths(self._jobs_root, job_id)
        ctx = JobContext(
            job_id=job_id,
            paths=paths,
            job=self._jobs[job_id],
            logger=JobLogger(paths.log_path),
            settings=get_settings(),
        )
        await self._run_stages(
            job_id=job_id,
            stages=stages,
            total_stages=len(stages),
            stages_done=0,
            ctx=ctx,
        )

    async def resume(self, job_id: str) -> None:
        """Resume a gate-paused job.

        T-106 calls this after the operator submits a corrected transcript.
        The runner continues from the stage after the gate.
        """
        if job_id not in self._pending:
            raise ValueError(
                f"No pending pipeline for job {job_id!r}. "
                "Job may not be paused, or may have already resumed."
            )
        pending = self._pending.pop(job_id)
        self._update_status(job_id, state=JobState.RUNNING)
        await self._run_stages(
            job_id=job_id,
            stages=pending.remaining_stages,
            total_stages=pending.total_stages,
            stages_done=pending.stages_done,
            ctx=pending.ctx,
        )

    async def _run_stages(
        self,
        job_id: str,
        stages: list[Stage],
        total_stages: int,
        stages_done: int,
        ctx: JobContext,
    ) -> None:
        for i, stage in enumerate(stages):
            if self._statuses[job_id].state == JobState.ERROR:
                return  # cancelled (or already failed) — stop advancing

            pct = stages_done / total_stages * 100.0 if total_stages else 0.0
            self._update_status(job_id, stage=stage.name, progress_pct=pct)

            t0 = time.monotonic()
            try:
                await stage.run(ctx)
            except Exception as exc:  # noqa: BLE001
                ctx.logger.log_error(stage.name, str(exc))
                self._update_status(
                    job_id,
                    state=JobState.ERROR,
                    message=f"Stage '{stage.name}' failed: {exc}",
                )
                return  # halt — do not run further stages

            duration = time.monotonic() - t0
            stages_done += 1
            ctx.logger.log_stage(stage.name, duration, stages_done=stages_done)

            if stage.is_gate:
                pct_at_gate = stages_done / total_stages * 100.0 if total_stages else 0.0
                ctx.logger.log_gate(stage.name)
                self._update_status(
                    job_id,
                    state=JobState.AWAITING_CORRECTION,
                    progress_pct=pct_at_gate,
                )
                remaining = stages[i + 1:]
                self._pending[job_id] = _PipelineState(
                    remaining_stages=remaining,
                    total_stages=total_stages,
                    stages_done=stages_done,
                    ctx=ctx,
                )
                return  # pause here; resume() continues

        # All stages completed
        self._update_status(
            job_id,
            state=JobState.READY_FOR_AE,
            progress_pct=100.0,
            stage="complete",
            message="",
        )
