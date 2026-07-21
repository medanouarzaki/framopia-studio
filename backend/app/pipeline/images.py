"""Image generation & sourcing stage — spec Stage 8 / §12.2, §12.4, §16.4.

Reads job_dir/visual_plan.json (T-110) and, for each visual:
    - generated_image: builds a prompt (§12.2), calls the mockable Gemini
      image client (T-104), and saves the result to EXACTLY the asset path
      T-110 named (job_dir/assets/images/<id>.png) — that exact-path contract
      is what makes T-112's validate_edit_plan(check_assets=True) pass.
    - client_asset: reframes to 9:16-safe via ffmpeg if not already close to
      9:16 (no Gemini call).
    - animated_text: no-op (text is rendered in AE from the template).

Output: job_dir/images.json (job root, D-021; placement logged in D-042).

## Injection seam for tests

``run_images`` accepts an optional ``_gemini_client`` keyword argument, same
pattern as T-105/T-108 (functools.partial in the Stage). Tests inject a
GeminiClient with a fixture transport and patch
``app.clients.gemini.get_settings`` (NOT ``app.config._settings``) — the
established pattern for this codebase. NO real network calls are made in
unit tests.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
import time
from pathlib import Path

from app.clients.ffmpeg import FfmpegError, probe
from app.clients.gemini import GeminiClient
from app.config import Settings
from app.jobs.manager import JobContext
from app.models.edit_plan import Visual
from app.models.understanding import Understanding, UnderstandingSegment
from app.util.cost import CostMeter

# ---------------------------------------------------------------------------
# Prompt construction defaults (spec §12.2)
# ---------------------------------------------------------------------------

# TODO(T-201): source these from the Brand Kit's image_style.default /
# image_style.negative once the Brand Kit loader exists. These module-level
# defaults are a sane placeholder in the meantime (D-042).
_DEFAULT_IMAGE_STYLE = (
    "clean modern editorial photography style, warm natural lighting, shallow depth of field"
)
_DEFAULT_NEGATIVE = "no text overlays, no watermark, no logos, no blurry or distorted subjects"

# Hard constraints (spec §12.2) — always appended, never overridable per-video.
_HARD_CONSTRAINTS = (
    "vertical 9:16 composition, no on-image text, no watermark, "
    "subject centered with headroom for the caption safe-area"
)

# ---------------------------------------------------------------------------
# Client-asset reframe defaults (D-043)
# ---------------------------------------------------------------------------

_TARGET_ASPECT_W, _TARGET_ASPECT_H = 9, 16
_ASPECT_TOLERANCE = 0.02  # ±2%, consistent with D-016's ingest tolerance
_REFRAME_TARGET_W = 1080
_REFRAME_TARGET_H = 1920
_REFRAME_PAD_COLOR = "black"


class ImagesError(RuntimeError):
    """Raised when the image stage fails.

    The message is human-readable and safe to surface to the operator.
    """


# ---------------------------------------------------------------------------
# Prompt construction
# ---------------------------------------------------------------------------


def _build_prompt(visual_intent: str, brief: str) -> str:
    """Assemble a generation prompt per spec §12.2.

    style + visual_intent (+ brief override, trivially wired) + negative +
    hard constraints (9:16, no on-image text, no watermark, centered/safe-area).
    """
    parts = [
        _DEFAULT_IMAGE_STYLE,
        f"Subject: {visual_intent}.",
    ]
    if brief:
        parts.append(f"Brief context: {brief}.")
    parts.append(f"Negative: {_DEFAULT_NEGATIVE}.")
    parts.append(f"Hard constraints: {_HARD_CONSTRAINTS}.")
    return " ".join(parts)


def _match_segment_intent(visual: Visual, segments: list[UnderstandingSegment]) -> str:
    """Recover the originating segment's visual_intent for a generated_image visual.

    T-110's ``Visual`` model carries no segment linkage (only ``animated_text``
    stores ``text``) — see D-045. Visual windows are constructed FROM a
    segment's [start, end] (snapped/clipped/extended), so the segment with the
    greatest time-overlap against the visual's window is its origin with very
    high reliability. Raises ImagesError if no segment overlaps at all (should
    not happen given how T-110 builds windows; a genuine desync is a fail-loud
    condition, not something to silently paper over).
    """
    best: UnderstandingSegment | None = None
    best_overlap = -1.0
    for seg in segments:
        overlap = min(visual.end, seg.end) - max(visual.start, seg.start)
        if overlap > best_overlap:
            best_overlap = overlap
            best = seg
    if best is None or best_overlap <= 0:
        raise ImagesError(
            f"Could not determine visual_intent for visual {visual.id!r}: "
            "no understanding.json segment overlaps its [start, end] window."
        )
    return best.visual_intent


def _select_model(settings: Settings) -> str:
    """Model selection (D-044): no hero/Pro escalation in v1 — always Flash.

    cheap_mode is a no-op today (there's nothing to disable) but is honored
    explicitly so a future hero-escalation rule respects it automatically.
    """
    return settings.gemini_image_model


# ---------------------------------------------------------------------------
# Client-asset reframe (ffmpeg subprocess, self-contained — D-043)
# ---------------------------------------------------------------------------


def _probe_dimensions(path: Path) -> tuple[int, int]:
    """Return (width, height) of an image/video file via the shared ffprobe client (D-020)."""
    try:
        result = probe(path)
    except FfmpegError as exc:
        raise ImagesError(str(exc)) from exc

    video_stream = next(
        (s for s in result.get("streams", []) if s.get("codec_type") == "video"),
        None,
    )
    if video_stream is None:
        raise ImagesError(f"No video/image stream found in {path.name!r}.")
    try:
        return int(video_stream["width"]), int(video_stream["height"])
    except (KeyError, ValueError) as exc:
        raise ImagesError(f"Could not parse ffprobe dimensions for {path.name!r}.") from exc


def _is_already_9x16(width: int, height: int) -> bool:
    target = _TARGET_ASPECT_W / _TARGET_ASPECT_H
    actual = width / height
    return abs(actual - target) <= _ASPECT_TOLERANCE


def _reframe_to_9x16(src: Path, dst: Path) -> None:
    """Letterbox-pad *src* to a 9:16-safe canvas via ffmpeg (deterministic)."""
    vf = (
        f"scale=w={_REFRAME_TARGET_W}:h={_REFRAME_TARGET_H}:force_original_aspect_ratio=decrease,"
        f"pad={_REFRAME_TARGET_W}:{_REFRAME_TARGET_H}:(ow-iw)/2:(oh-ih)/2:color={_REFRAME_PAD_COLOR}"
    )
    try:
        proc = subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-vf", vf, "-frames:v", "1", str(dst)],
            capture_output=True,
            text=True,
            timeout=60,
        )
    except FileNotFoundError as exc:
        raise ImagesError("ffmpeg not found. Install ffmpeg (brew install ffmpeg).") from exc
    except subprocess.TimeoutExpired as exc:
        raise ImagesError(f"ffmpeg timed out reframing {src.name!r}.") from exc

    if proc.returncode != 0:
        raise ImagesError(
            f"ffmpeg exited {proc.returncode} reframing {src.name!r}: {proc.stderr.strip()}"
        )


# ---------------------------------------------------------------------------
# Stage entry point
# ---------------------------------------------------------------------------


async def run_images(
    ctx: JobContext,
    *,
    _gemini_client: GeminiClient | None = None,
) -> None:
    """Image-generation & sourcing stage entry point.

    Called by the T-101 stage runner via Stage(name="images", run=run_images).
    Raises ImagesError on any non-recoverable failure (missing input, ffmpeg
    unavailable for a required reframe). Hitting the per-job image ceiling is
    NOT an error — remaining generated_image visuals are flagged un-filled in
    the stage artifact and the job proceeds.

    Args:
        ctx:             Job context from the runner.
        _gemini_client:  Injectable GeminiClient for tests. Leave None in
                          production (a real GeminiClient is created internally).
    """
    t0 = time.monotonic()

    plan_path = ctx.paths.job_dir / "visual_plan.json"
    understanding_path = ctx.paths.job_dir / "understanding.json"
    if not plan_path.exists() or not plan_path.is_file():
        raise ImagesError(
            f"visual_plan.json not found at {plan_path}. "
            "Run the visual-planning stage (T-110) before image generation."
        )
    if not understanding_path.exists() or not understanding_path.is_file():
        raise ImagesError(
            f"understanding.json not found at {understanding_path}. "
            "Required to recover visual_intent for generated_image prompts (D-045)."
        )
    try:
        plan = json.loads(plan_path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise ImagesError(f"Could not read visual_plan.json: {exc}") from exc

    try:
        visuals = [Visual.model_validate(v) for v in plan.get("visuals", [])]
    except Exception as exc:
        raise ImagesError(f"visual_plan.json visuals failed schema validation: {exc}") from exc

    try:
        understanding = Understanding.model_validate_json(
            understanding_path.read_text(encoding="utf-8")
        )
    except Exception as exc:
        raise ImagesError(f"Could not read/validate understanding.json: {exc}") from exc

    client = _gemini_client if _gemini_client is not None else GeminiClient()
    meter = CostMeter()
    model_id = _select_model(ctx.settings)

    prompt_cache: dict[str, bytes] = {}
    manifest_entries: list[dict] = []
    generated_count = 0
    cached_count = 0
    skipped_ceiling_count = 0
    client_reframed_count = 0

    for visual in visuals:
        if visual.kind == "animated_text":
            manifest_entries.append(
                {"visual_id": visual.id, "kind": visual.kind, "status": "skipped_no_image"}
            )
            continue

        if visual.kind == "generated_image":
            visual_intent = _match_segment_intent(visual, understanding.segments)
            prompt = _build_prompt(visual_intent, ctx.job.brief)
            prompt_hash = hashlib.sha256(prompt.encode("utf-8")).hexdigest()

            if prompt_hash in prompt_cache:
                image_bytes = prompt_cache[prompt_hash]
                status = "cached"
                cached_count += 1
            elif generated_count >= ctx.settings.max_images_per_job:
                manifest_entries.append(
                    {
                        "visual_id": visual.id,
                        "kind": visual.kind,
                        "status": "skipped_ceiling",
                        "asset": visual.asset,
                    }
                )
                skipped_ceiling_count += 1
                continue
            else:
                result = client.generate_image(prompt, model=model_id, meter=meter)
                image_bytes = result.image_bytes
                prompt_cache[prompt_hash] = image_bytes
                status = "generated"
                generated_count += 1

            dst = ctx.paths.job_dir / visual.asset
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_bytes(image_bytes)
            manifest_entries.append(
                {
                    "visual_id": visual.id,
                    "kind": visual.kind,
                    "status": status,
                    "asset": visual.asset,
                    "model": model_id,
                    "prompt_hash": prompt_hash,
                }
            )
            continue

        # kind == "client_asset"
        src = ctx.paths.job_dir / visual.asset
        if not src.exists() or not src.is_file():
            raise ImagesError(
                f"client_asset visual {visual.id!r} references missing file: {src}"
            )
        width, height = _probe_dimensions(src)
        if _is_already_9x16(width, height):
            manifest_entries.append(
                {
                    "visual_id": visual.id,
                    "kind": visual.kind,
                    "status": "unchanged",
                    "asset": visual.asset,
                }
            )
            continue

        dst_name = f"{src.stem}_9x16{src.suffix}"
        dst = src.parent / dst_name
        _reframe_to_9x16(src, dst)
        client_reframed_count += 1
        manifest_entries.append(
            {
                "visual_id": visual.id,
                "kind": visual.kind,
                "status": "reframed",
                "source_asset": visual.asset,
                "asset": f"assets/client/{dst_name}",
            }
        )

    out = ctx.paths.job_dir / "images.json"
    out.write_text(
        json.dumps(
            {
                "images": manifest_entries,
                "generated": generated_count,
                "cached": cached_count,
                "client_reframed": client_reframed_count,
                "skipped_ceiling": skipped_ceiling_count,
                "cost_estimate_usd": meter.total(),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    elapsed = time.monotonic() - t0
    ctx.logger.log_stage(
        "images",
        elapsed,
        generated=generated_count,
        cached=cached_count,
        client_reframed=client_reframed_count,
        skipped_ceiling=skipped_ceiling_count,
    )
