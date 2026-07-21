"""Ingest stage — spec Stage 1 / §7 / §14.3.

Probes the source take with ffprobe, validates 9:16 aspect and sane duration,
copies the take to job_dir/input.mp4 (canonical location), copies any client
assets to client_dir, and fills ctx.job.width/height/fps/duration.

Design decision D-015: source_path and client_asset_paths are recorded on the
Job at create() time so the Stage.run(ctx) interface needs no extra parameters.
"""

from __future__ import annotations

import asyncio
import shutil
import time
from pathlib import Path

from app.clients.ffmpeg import FfmpegError, probe
from app.jobs.manager import JobContext

# ---------------------------------------------------------------------------
# Validation constants (D-016 / D-017 / D-018)
# ---------------------------------------------------------------------------

# Accept aspect ratio within ±2% of 9:16 to handle codec-aligned dimensions
# (e.g. 1088×1920 passes; 1920×1080 is rejected with a clear message).
_TARGET_ASPECT: float = 9.0 / 16.0
_ASPECT_TOLERANCE: float = 0.02

# Duration bounds: reject < 1 s (nonsense clip) or > 300 s (5 min; well above
# the 90 s design ceiling in spec §3). Covers normal ~30 s reels with room.
_MIN_DURATION_S: float = 1.0
_MAX_DURATION_S: float = 300.0

# Warn (do not reject) when fps falls outside the typical broadcast range.
_FPS_WARN_LOW: float = 24.0
_FPS_WARN_HIGH: float = 60.0


# ---------------------------------------------------------------------------
# Public error type
# ---------------------------------------------------------------------------


class IngestError(RuntimeError):
    """Raised when the ingest stage cannot accept the source take.

    The message is human-readable and safe to surface directly to the operator.
    """


# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------


def _parse_fps(r_frame_rate: str) -> float:
    """Convert 'num/den' fraction string to float fps."""
    num, sep, den = r_frame_rate.partition("/")
    if sep and den and float(den) != 0:
        return float(num) / float(den)
    return float(num)


def _effective_wh(stream: dict) -> tuple[int, int]:
    """Return (width, height) after accounting for display rotation metadata.

    Phones often record 1920×1080 with a 90° rotation tag so the image is
    displayed as portrait 1080×1920.  We swap w/h for 90° and 270° cases so
    the rest of the pipeline always works with the displayed dimensions.
    """
    w, h = int(stream["width"]), int(stream["height"])

    rotation = 0
    # Prefer side_data_list (set by modern encoders / remuxers)
    for sd in stream.get("side_data_list", []):
        if "rotation" in sd:
            rotation = int(sd["rotation"]) % 360
            break
    # Fall back to the older tags.rotate field
    if not rotation:
        tag = stream.get("tags", {}).get("rotate", "")
        if tag:
            rotation = int(tag) % 360

    if rotation in (90, 270):
        w, h = h, w
    return w, h


# ---------------------------------------------------------------------------
# Main stage entry point
# ---------------------------------------------------------------------------


async def run_ingest(ctx: JobContext) -> None:
    """Ingest stage: validate, copy, and probe the source take.

    Called by the T-101 stage runner via Stage(name="ingest", run=run_ingest).
    On any validation or I/O failure, raises IngestError (a RuntimeError subclass)
    so the runner sets job state to ERROR with the human-readable message.
    """
    t0 = time.monotonic()

    # ------------------------------------------------------------------
    # 1. Locate and verify the source file
    # ------------------------------------------------------------------
    source_path_str = ctx.job.source_path
    if not source_path_str:
        raise IngestError(
            "No source_path set on this job. "
            "Pass source_path= to JobManager.create() before running ingest."
        )

    source = Path(source_path_str)
    if not source.exists():
        raise IngestError(
            f"Source take not found: {source}\n"
            "Verify the path and that the file is accessible from this machine."
        )
    if not source.is_file():
        raise IngestError(f"source_path is not a regular file: {source}")

    # ------------------------------------------------------------------
    # 2. Probe with ffprobe (shared app.clients.ffmpeg.probe — D-020)
    # ------------------------------------------------------------------
    try:
        probe_result = probe(source)
    except FfmpegError as exc:
        raise IngestError(str(exc)) from exc

    video_stream = next(
        (s for s in probe_result.get("streams", []) if s.get("codec_type") == "video"),
        None,
    )
    if video_stream is None:
        raise IngestError(
            f"No video stream found in {source.name!r}. "
            "Is this actually a video file?"
        )

    width, height = _effective_wh(video_stream)

    raw_fps = video_stream.get("r_frame_rate", "")
    if not raw_fps or raw_fps in ("0/0", "0"):
        raise IngestError(f"Could not read frame rate from {source.name!r}.")
    fps = _parse_fps(raw_fps)

    duration_str = probe_result.get("format", {}).get("duration", "")
    if not duration_str:
        raise IngestError(f"Could not read duration from {source.name!r}.")
    duration = float(duration_str)

    # ------------------------------------------------------------------
    # 3. Validate aspect ratio (reject if not 9:16)
    # ------------------------------------------------------------------
    aspect = width / height
    if abs(aspect - _TARGET_ASPECT) > _ASPECT_TOLERANCE:
        raise IngestError(
            f"Source take is not 9:16. "
            f"Effective size: {width}×{height} "
            f"(aspect {aspect:.4f}, required {_TARGET_ASPECT:.4f} ±{_ASPECT_TOLERANCE}). "
            "Framopia Studio requires a portrait 9:16 take. "
            "Re-export or crop to 1080×1920 or 720×1280 before ingesting."
        )

    # ------------------------------------------------------------------
    # 4. Validate duration (reject extremes)
    # ------------------------------------------------------------------
    if duration < _MIN_DURATION_S:
        raise IngestError(
            f"Source take is too short ({duration:.2f} s < {_MIN_DURATION_S} s minimum). "
            "Provide a proper cut, not a test flash."
        )
    if duration > _MAX_DURATION_S:
        raise IngestError(
            f"Source take is too long ({duration:.1f} s > {_MAX_DURATION_S} s maximum). "
            "Framopia Studio is designed for ~30 s reels (up to ~90 s). "
            f"Trim the take to under {_MAX_DURATION_S} s and re-ingest."
        )

    # ------------------------------------------------------------------
    # 5. Warn on unusual fps (do NOT reject)
    # ------------------------------------------------------------------
    fps_warning: str | None = None
    if not (_FPS_WARN_LOW <= fps <= _FPS_WARN_HIGH):
        fps_warning = (
            f"Unusual frame rate: {fps:.4g} fps "
            f"(normal range {_FPS_WARN_LOW}–{_FPS_WARN_HIGH} fps). "
            "Proceeding — verify that the AE comp frame rate matches."
        )

    # ------------------------------------------------------------------
    # 6. Copy take to canonical job location (job_dir/input.mp4)
    # ------------------------------------------------------------------
    canonical = ctx.paths.job_dir / "input.mp4"
    await asyncio.to_thread(shutil.copy2, str(source), str(canonical))

    # ------------------------------------------------------------------
    # 7. Copy client assets into client_dir
    # ------------------------------------------------------------------
    copied_assets = 0
    for asset_str in ctx.job.client_asset_paths:
        asset = Path(asset_str)
        if not asset.exists():
            ctx.logger.log_stage(
                "ingest.asset_skip", 0.0,
                path=str(asset), reason="file not found — skipped",
            )
            continue
        await asyncio.to_thread(
            shutil.copy2, str(asset), str(ctx.paths.client_dir / asset.name)
        )
        copied_assets += 1

    # ------------------------------------------------------------------
    # 8. Update durable job record and write job.json
    # ------------------------------------------------------------------
    ctx.job.width = width
    ctx.job.height = height
    ctx.job.fps = round(fps)  # Job.fps is int; round 29.97 → 30
    ctx.job.duration = duration
    ctx.paths.job_json_path.write_text(
        ctx.job.model_dump_json(indent=2), encoding="utf-8"
    )

    # ------------------------------------------------------------------
    # 9. Log completion
    # ------------------------------------------------------------------
    elapsed = time.monotonic() - t0
    ctx.logger.log_stage(
        "ingest",
        elapsed,
        width=width,
        height=height,
        fps=fps,
        duration=duration,
        client_assets=copied_assets,
        **({"fps_warning": fps_warning} if fps_warning else {}),
    )
