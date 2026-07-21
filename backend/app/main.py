"""Framopia Studio backend — FastAPI application entry point."""

import json
import shutil

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Request
from pydantic import BaseModel, Field

from app import __version__
from app.config import get_settings
from app.jobs.manager import JobManager, build_pipeline_stages
from app.jobs.paths import WorkspacePaths
from app.models.job import JobState
from app.models.transcript import Transcript

# SERVER_HOST is hardcoded and NOT sourced from config (spec §21 / D-010).
# Binding to anything other than 127.0.0.1 must be structurally impossible,
# not just conventionally avoided. SERVER_PORT comes from Settings.backend_port.
SERVER_HOST = "127.0.0.1"

app = FastAPI(title="Framopia Studio Backend", version=__version__)


# ---------------------------------------------------------------------------
# Manager dependency — lazy singleton, overridable in tests
# ---------------------------------------------------------------------------


def _get_manager(request: Request) -> JobManager:
    """FastAPI dependency: return the app-wide JobManager.

    Initialised on first use with the default jobs_root (D-014).
    Tests override it by assigning to app.state.job_manager before calling
    any endpoint; the lazy check here means no lifespan is needed.
    """
    if not hasattr(request.app.state, "job_manager"):
        request.app.state.job_manager = JobManager()
    return request.app.state.job_manager


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------


@app.get("/health")
def health() -> dict:
    """Return service readiness. Checks ffmpeg on PATH and Gemini key presence."""
    settings = get_settings()
    ffmpeg_ok: bool = shutil.which("ffmpeg") is not None
    keys_ok: bool = (
        settings.gemini_api_key is not None
        and len(settings.gemini_api_key.get_secret_value()) > 0
    )
    return {
        "status": "ok",
        "version": __version__,
        "ffmpeg_ok": ffmpeg_ok,
        "keys_ok": keys_ok,
    }


# ---------------------------------------------------------------------------
# Brand Kits (stub — spec §14.1)
# ---------------------------------------------------------------------------


@app.get("/brand_kits")
def list_brand_kits() -> list:
    """Return the list of available Brand Kits.

    STUB: no Brand Kit loader exists until T-201 (M2). Always returns an
    empty list. POST /jobs still accepts `brand_kit` as an opaque string —
    it does not need to resolve to a loadable kit yet. Do NOT build kit
    loading here; that is T-201's job.
    """
    return []


# ---------------------------------------------------------------------------
# Job creation + status + cancellation (spec §14.1)
# ---------------------------------------------------------------------------


class CreateJobRequest(BaseModel):
    """Request body for POST /jobs (spec §14.1)."""

    video_path: str
    brand_kit: str
    brief: str = ""
    client_asset_paths: list[str] = Field(default_factory=list)


@app.post("/jobs")
def create_job(
    body: CreateJobRequest,
    background_tasks: BackgroundTasks,
    mgr: JobManager = Depends(_get_manager),  # noqa: B008
) -> dict:
    """Create a job and start the pipeline in the background.

    Runs Stages 1-3 (ingest, audio, asr) then pauses at the correction gate
    in AWAITING_CORRECTION state. Returns the job_id immediately without
    waiting for the pipeline — the panel polls GET /jobs/{id}/status.

    `brand_kit` is accepted as an opaque string (M2/T-201 not built yet).
    """
    job = mgr.create(
        brand_kit=body.brand_kit,
        brief=body.brief,
        source_path=body.video_path,
        client_asset_paths=body.client_asset_paths,
    )
    stages = build_pipeline_stages()
    background_tasks.add_task(mgr.run_pipeline, job.job_id, stages)
    return {"job_id": job.job_id}


@app.get("/jobs/{job_id}/status")
def get_job_status(
    job_id: str,
    mgr: JobManager = Depends(_get_manager),  # noqa: B008
) -> dict:
    """Return the live status of a job. 404 if the job is unknown."""
    try:
        status = mgr.status(job_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Job {job_id!r} not found.") from None
    return {
        "stage": status.stage,
        "progress_pct": status.progress_pct,
        "state": status.state.value,
        "message": status.message,
    }


@app.post("/jobs/{job_id}/cancel")
def cancel_job(
    job_id: str,
    mgr: JobManager = Depends(_get_manager),  # noqa: B008
) -> dict:
    """Cancel a running job, transitioning it to a terminal error state.

    Idempotent-safe: calling this on an already-finished job (ready_for_ae
    or error) is a clean no-op — it returns the current status, not an error.

    Errors:
        404: Job not found.
    """
    try:
        mgr.get_job(job_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Job {job_id!r} not found.") from None

    status = mgr.cancel(job_id)
    return {
        "job_id": job_id,
        "state": status.state.value,
        "message": status.message,
    }


# ---------------------------------------------------------------------------
# Edit Plan + build report (spec §14.1)
# ---------------------------------------------------------------------------


@app.get("/jobs/{job_id}/edit_plan")
def get_edit_plan(
    job_id: str,
    mgr: JobManager = Depends(_get_manager),  # noqa: B008
) -> dict:
    """Serve the final Edit Plan for a job.

    Errors:
        404: Job not found, or the job has not reached ready_for_ae /
             edit_plan.json is not on disk yet.
    """
    try:
        mgr.get_job(job_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Job {job_id!r} not found.") from None

    status = mgr.status(job_id)
    paths = WorkspacePaths(mgr._jobs_root, job_id)
    plan_path = paths.job_dir / "edit_plan.json"
    if status.state != JobState.READY_FOR_AE or not plan_path.exists():
        raise HTTPException(
            status_code=404,
            detail=(
                f"Edit Plan not ready for job {job_id!r} "
                f"(state={status.state.value!r})."
            ),
        )
    return json.loads(plan_path.read_text(encoding="utf-8"))


@app.get("/jobs/{job_id}/build_report")
def get_build_report(
    job_id: str,
    mgr: JobManager = Depends(_get_manager),  # noqa: B008
) -> dict:
    """Serve the AE build report the CEP panel posts back after a build (M3+).

    Errors:
        404: Job not found, or no build report has been posted yet.
    """
    try:
        mgr.get_job(job_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Job {job_id!r} not found.") from None

    paths = WorkspacePaths(mgr._jobs_root, job_id)
    report_path = paths.job_dir / "build_report.json"
    if not report_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"No build report posted yet for job {job_id!r}.",
        )
    return json.loads(report_path.read_text(encoding="utf-8"))


@app.post("/jobs/{job_id}/build_report")
def post_build_report(
    job_id: str,
    body: dict,
    mgr: JobManager = Depends(_get_manager),  # noqa: B008
) -> dict:
    """Accept a build report posted by the AE panel (M3+). Minimal passthrough.

    Errors:
        404: Job not found.
    """
    try:
        mgr.get_job(job_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Job {job_id!r} not found.") from None

    paths = WorkspacePaths(mgr._jobs_root, job_id)
    paths.job_dir.mkdir(parents=True, exist_ok=True)
    (paths.job_dir / "build_report.json").write_text(
        json.dumps(body, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return {"ok": True}


# ---------------------------------------------------------------------------
# Transcript correction gate endpoints (spec Stage 4 / §14.1 / §14.2)
# ---------------------------------------------------------------------------


@app.get("/jobs/{job_id}/transcript")
def get_transcript(
    job_id: str,
    mgr: JobManager = Depends(_get_manager),  # noqa: B008
) -> dict:
    """Return the raw ASR transcript for the operator correction UI.

    The transcript lives at job_dir/transcript_raw.json (written by the ASR
    stage, T-105). The correction UI renders the segments and lets the operator
    fix transcription errors before the pipeline resumes.

    Errors:
        404: Job not found, or ASR stage has not completed yet.
    """
    try:
        mgr.get_job(job_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Job {job_id!r} not found.") from None

    paths = WorkspacePaths(mgr._jobs_root, job_id)
    raw_path = paths.job_dir / "transcript_raw.json"
    if not raw_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Transcript not ready — the ASR stage has not completed for this job.",
        )

    return json.loads(raw_path.read_text(encoding="utf-8"))


@app.post("/jobs/{job_id}/transcript")
async def post_transcript(
    job_id: str,
    body: Transcript,
    background_tasks: BackgroundTasks,
    mgr: JobManager = Depends(_get_manager),  # noqa: B008
) -> dict:
    """Accept the operator-corrected transcript and resume the pipeline.

    Validates the body against the Transcript schema (§14.3). On success,
    writes transcript_corrected.json at the job root and schedules
    mgr.resume() as a background task so the POST returns immediately
    while the remaining pipeline stages run asynchronously (§14.2).

    The gate is the quality keystone (spec Stage 4): this endpoint is the
    ONLY way to advance a job past AWAITING_CORRECTION. It MUST NOT be
    bypassed or auto-called.

    Arabic in the corrected transcript is stored in logical (codepoint) order
    via ensure_ascii=False (BIDI trap — BUILD_STATE §5 / D-027).

    Errors:
        404: Job not found.
        409: Job is not currently awaiting correction.
        422: Request body fails Transcript schema validation (FastAPI / Pydantic).
    """
    try:
        mgr.get_job(job_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Job {job_id!r} not found.") from None

    status = mgr.status(job_id)
    if status.state != JobState.AWAITING_CORRECTION:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Job {job_id!r} is not awaiting correction "
                f"(current state: {status.state.value!r}). "
                "Only a job in 'awaiting_correction' can receive a corrected transcript."
            ),
        )

    # Write transcript_corrected.json at the job root (D-021 / D-027).
    # Override job_id from the URL so the file is always self-consistent.
    paths = WorkspacePaths(mgr._jobs_root, job_id)
    corrected_data = body.model_dump()
    corrected_data["job_id"] = job_id  # URL wins over body (D-027)

    out = paths.job_dir / "transcript_corrected.json"
    out.write_text(
        json.dumps(corrected_data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    # Resume the pipeline in the background so the POST returns immediately (§14.2).
    background_tasks.add_task(mgr.resume, job_id)

    return {"ok": True, "job_id": job_id}


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run("app.main:app", host=SERVER_HOST, port=settings.backend_port, reload=True)
