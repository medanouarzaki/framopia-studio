"""Per-job structured logger writing JSON lines to log.txt (spec §20).

Rules:
- Never log secrets, API keys, or any value retrieved via .get_secret_value().
- Each line is a complete JSON object terminated by a newline (JSON Lines format).
- Stages log their name, wall-clock duration, and an optional key/count field.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path


class JobLogger:
    """Append-only structured logger for a single job's log.txt."""

    def __init__(self, log_path: Path) -> None:
        self._path = log_path

    def _write(self, entry: dict) -> None:
        with self._path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(entry, default=str) + "\n")

    def log_stage(self, stage: str, duration_s: float, **kwargs: object) -> None:
        """Log successful stage completion with duration and optional metadata.

        Args:
            stage: Stage name.
            duration_s: Wall-clock duration in seconds.
            **kwargs: Additional structured fields (e.g. word_count=42, cost_usd=0.04).
                      Must NOT contain secrets or key values.
        """
        self._write({
            "ts": datetime.now(UTC).isoformat(),
            "stage": stage,
            "duration_s": round(duration_s, 3),
            **kwargs,
        })

    def log_error(self, stage: str, error: str) -> None:
        """Log a stage failure.

        Args:
            stage: Stage name that failed.
            error: Human-readable error description. Must NOT contain secrets.
        """
        self._write({
            "ts": datetime.now(UTC).isoformat(),
            "stage": stage,
            "error": error,
        })

    def log_gate(self, stage: str) -> None:
        """Log that the pipeline paused at a gate stage."""
        self._write({
            "ts": datetime.now(UTC).isoformat(),
            "stage": stage,
            "gate": True,
            "state": "awaiting_correction",
        })
