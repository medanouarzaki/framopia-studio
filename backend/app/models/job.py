"""Job lifecycle models (spec §14.1 / §14.2)."""

from __future__ import annotations

import enum

from pydantic import BaseModel, Field, field_validator


class JobState(enum.StrEnum):
    """Possible lifecycle states of a job.

    String values are spec-mandated (§14.1) — the CEP panel and HTTP endpoints
    read these strings verbatim. Do not rename without updating both.
    """

    RUNNING = "running"
    AWAITING_CORRECTION = "awaiting_correction"
    READY_FOR_AE = "ready_for_ae"
    ERROR = "error"


class JobStatus(BaseModel):
    """Live status of a job: state machine position, current stage, and progress."""

    state: JobState
    stage: str
    progress_pct: float
    message: str = ""

    @field_validator("progress_pct")
    @classmethod
    def clamp_progress(cls, v: float) -> float:
        """Clamp progress_pct to [0, 100]."""
        return max(0.0, min(100.0, v))


class Job(BaseModel):
    """Durable job record persisted as job.json in the workspace.

    Source properties (width/height/fps/duration) are filled by the ingest stage
    (T-102); they are None until then. model_ids records the exact Gemini model ids
    used per job for reproducibility (§14.4); populated by clients as they call out.
    """

    job_id: str
    created_at: str  # ISO 8601 UTC
    brand_kit: str
    brief: str

    # Filled by ingest (T-102)
    width: int | None = None
    height: int | None = None
    fps: int | None = None
    duration: float | None = None

    # Set at create() time so the ingest stage knows what to copy in (D-015)
    source_path: str | None = None
    client_asset_paths: list[str] = Field(default_factory=list)

    model_ids: dict = Field(default_factory=dict)
