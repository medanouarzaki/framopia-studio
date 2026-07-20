"""Workspace path helpers — the single source of truth for job filesystem layout.

All pipeline stages and the job manager import from here. Nothing hardcodes
paths elsewhere. The jobs-root is always injectable (tests use tmp_path).
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

# Repo root: this file is at backend/app/jobs/paths.py
# parents[0]=jobs, [1]=app, [2]=backend, [3]=repo root
_REPO_ROOT: Path = Path(__file__).resolve().parents[3]

# Default jobs-root: the repo-level /jobs/ dir (git-ignored per spec §15).
# NOT inside backend/ — jobs are workspace data, not code.
DEFAULT_JOBS_ROOT: Path = _REPO_ROOT / "jobs"


@dataclass(frozen=True)
class WorkspacePaths:
    """All filesystem paths for a single job, derived from jobs_root and job_id.

    Instantiate once per job; pass the object as part of JobContext so every
    stage has a consistent, type-safe view of the workspace layout.
    """

    jobs_root: Path
    job_id: str

    @property
    def job_dir(self) -> Path:
        """Root directory for this job: jobs/<job_id>/"""
        return self.jobs_root / self.job_id

    @property
    def assets_dir(self) -> Path:
        """jobs/<job_id>/assets/"""
        return self.job_dir / "assets"

    @property
    def images_dir(self) -> Path:
        """jobs/<job_id>/assets/images/ — generated and sourced B-roll images."""
        return self.assets_dir / "images"

    @property
    def audio_dir(self) -> Path:
        """jobs/<job_id>/assets/audio/ — selected music and SFX copies."""
        return self.assets_dir / "audio"

    @property
    def client_dir(self) -> Path:
        """jobs/<job_id>/assets/client/ — operator-supplied client assets."""
        return self.assets_dir / "client"

    @property
    def job_json_path(self) -> Path:
        """jobs/<job_id>/job.json — durable job metadata."""
        return self.job_dir / "job.json"

    @property
    def log_path(self) -> Path:
        """jobs/<job_id>/log.txt — structured per-stage log (JSON lines)."""
        return self.job_dir / "log.txt"
