"""Edit Plan assembly + validation stage — spec Stage 10 / §8.

The convergence point of the M1 pipeline: reads every upstream job-root
artifact (words.json, understanding.json, visual_plan.json, images.json,
music.json, beats.json) plus ctx.job, combines them into a single EditPlan,
validates it (in-plan Pydantic rules + template/asset checks), and writes
job_dir/edit_plan.json. Makes NO API calls.

Fail-loud (spec §20): on ANY validation failure, nothing partial is written —
the stage raises AssembleError so the runner sets the job to error.

## Injection seam for tests

``run_assemble_plan`` accepts an optional ``_now`` keyword argument — a
zero-arg callable returning a ``datetime`` — used for ``meta.generated_at``.
Leave it None in production (uses ``datetime.now(UTC)``); tests inject a
fixed clock so byte-identical determinism can be asserted directly on the
written file (D-048).
"""

from __future__ import annotations

import json
import time
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path

from app.jobs.manager import JobContext
from app.models.edit_plan import (
    AudioPlan,
    CaptionLine,
    EditPlan,
    Meta,
    Motion,
    Reel,
    Source,
    Visual,
    Word,
)
from app.models.understanding import Understanding
from app.models.validate import EditPlanValidationError, validate_edit_plan
from app.models.words import WordTiming
from app.pipeline.music import _FALLBACK_REEL_DURATION_S as FALLBACK_REEL_DURATION_S

# V1 template-name set (spec Appendix F / BUILD_STATE §6).
# TODO(T-202): replace this stub with the real registry.json loader's set
# once the template registry exists — consistent with D-008 (known_templates
# is opt-in; this is the "in" state until T-202 lands).
V1_TEMPLATE_NAMES: set[str] = {
    "caption_karaoke_default",
    "image_reveal_slideup",
    "image_reveal_scalein",
    "animtext_bold",
    "punch_soft",
    "transition_whip_pan",
}

# Reel-dimension fallbacks (D-049), used only if ctx.job.width/height/fps are
# unset (e.g. assembly exercised before/without a full ingest). Matches the
# golden example's reel resolution and T-111's reframe target (D-043).
_FALLBACK_REEL_WIDTH = 1080
_FALLBACK_REEL_HEIGHT = 1920
_FALLBACK_REEL_FPS = 30

_SCHEMA_VERSION = "1.0"


class AssembleError(RuntimeError):
    """Raised when Edit Plan assembly or validation fails.

    The message is human-readable and safe to surface to the operator.
    """


def _read_json(path: Path, label: str) -> dict | list:
    if not path.exists() or not path.is_file():
        raise AssembleError(
            f"{path.name} not found at {path}. Run the {label} stage before assembly."
        )
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise AssembleError(f"Could not read {path.name}: {exc}") from exc


def _build_captions(words_raw: list[dict], understanding: Understanding) -> list[CaptionLine]:
    """Group words.json (flat, global order) into CaptionLines by segment_index.

    Emphasis flags come from understanding.json's per-segment
    emphasis_word_indices, which are GLOBAL indices into words.json (D-034).
    """
    try:
        words = [WordTiming.model_validate(w) for w in words_raw]
    except Exception as exc:
        raise AssembleError(f"words.json failed schema validation: {exc}") from exc

    emphasis_by_segment: dict[int, set[int]] = {
        seg.index: set(seg.emphasis_word_indices) for seg in understanding.segments
    }

    groups: dict[int, list[Word]] = {}
    for global_idx, w in enumerate(words):
        emphasis_set = emphasis_by_segment.get(w.segment_index, set())
        groups.setdefault(w.segment_index, []).append(
            Word(
                text=w.word,
                script=w.script,
                start=w.start,
                end=w.end,
                emphasis=global_idx in emphasis_set,
            )
        )

    captions: list[CaptionLine] = []
    for segment_index in sorted(groups):
        try:
            captions.append(
                CaptionLine(
                    segment_index=segment_index,
                    template="caption_karaoke_default",
                    words=groups[segment_index],
                )
            )
        except Exception as exc:
            raise AssembleError(
                f"Segment {segment_index}: caption assembly failed (fail-loud, no reordering): {exc}"
            ) from exc
    return captions


def _reconcile_visuals_and_motion(
    visuals_raw: list[dict],
    motion_raw: list[dict],
    images_by_id: dict[str, dict],
) -> tuple[list[Visual], list[Motion], list[str]]:
    """Reconcile visual_plan.json against images.json (D-047).

    generated_image: keep as-is if generated/cached; DROP if skipped_ceiling
    (caller logs the drop). client_asset: swap in the manifest's authoritative
    asset path (reframed or unchanged). animated_text: unchanged. Any
    transition motion item whose `at` equals a DROPPED visual's start is
    removed with it — other motion is untouched.

    Returns (final_visuals, final_motion, dropped_visual_ids).
    """
    try:
        visuals = [Visual.model_validate(v) for v in visuals_raw]
        motion = [Motion.model_validate(m) for m in motion_raw]
    except Exception as exc:
        raise AssembleError(f"visual_plan.json failed schema validation: {exc}") from exc

    final_visuals: list[Visual] = []
    dropped_starts: set[float] = set()
    dropped_ids: list[str] = []

    for visual in visuals:
        entry = images_by_id.get(visual.id)
        if entry is None:
            raise AssembleError(
                f"Visual {visual.id!r} has no corresponding images.json entry — "
                "T-111 must process every visual from visual_plan.json."
            )

        if visual.kind == "generated_image":
            status = entry.get("status")
            if status in ("generated", "cached"):
                final_visuals.append(visual)
            elif status == "skipped_ceiling":
                dropped_starts.add(visual.start)
                dropped_ids.append(visual.id)
            else:
                raise AssembleError(
                    f"Visual {visual.id!r}: unexpected images.json status {status!r}."
                )
        elif visual.kind == "client_asset":
            new_asset = entry.get("asset")
            if not new_asset:
                raise AssembleError(
                    f"Visual {visual.id!r} (client_asset) has no 'asset' in its images.json entry."
                )
            final_visuals.append(visual.model_copy(update={"asset": new_asset}))
        else:  # animated_text
            final_visuals.append(visual)

    final_motion = [
        m for m in motion if not (m.kind == "transition" and m.at in dropped_starts)
    ]

    return final_visuals, final_motion, dropped_ids


async def run_assemble_plan(
    ctx: JobContext,
    *,
    _now: Callable[[], datetime] | None = None,
) -> None:
    """Edit Plan assembly stage entry point.

    Called by the T-101 stage runner via Stage(name="assemble_plan", run=run_assemble_plan).
    Raises AssembleError on any failure so the runner sets job state to ERROR;
    NO partial edit_plan.json is ever written on failure.

    Args:
        ctx:   Job context from the runner.
        _now:  Injectable clock for meta.generated_at. Leave None in production.
    """
    t0 = time.monotonic()
    job_dir = ctx.paths.job_dir

    words_raw = _read_json(job_dir / "words.json", "forced-alignment (T-107)")
    understanding_raw = _read_json(job_dir / "understanding.json", "understanding (T-108)")
    visual_plan_raw = _read_json(job_dir / "visual_plan.json", "visual-planning (T-110)")
    images_raw = _read_json(job_dir / "images.json", "image generation (T-111)")
    music_raw = _read_json(job_dir / "music.json", "music-selection (T-109)")
    beats_raw = _read_json(job_dir / "beats.json", "music-selection (T-109)")

    if not isinstance(words_raw, list):
        raise AssembleError("words.json must be a JSON array.")
    if not isinstance(beats_raw, list):
        raise AssembleError("beats.json must be a JSON array.")

    try:
        understanding = Understanding.model_validate(understanding_raw)
    except Exception as exc:
        raise AssembleError(f"understanding.json failed schema validation: {exc}") from exc

    try:
        audio_plan = AudioPlan.model_validate(music_raw)
    except Exception as exc:
        raise AssembleError(f"music.json failed schema validation: {exc}") from exc

    if not isinstance(images_raw, dict) or "images" not in images_raw:
        raise AssembleError("images.json must be an object with an 'images' array.")
    images_by_id: dict[str, dict] = {e["visual_id"]: e for e in images_raw["images"]}
    images_cost_usd: float = float(images_raw.get("cost_estimate_usd", 0.0))

    captions = _build_captions(words_raw, understanding)
    visuals, motion, dropped_ids = _reconcile_visuals_and_motion(
        visual_plan_raw.get("visuals", []),
        visual_plan_raw.get("motion", []),
        images_by_id,
    )

    # Reel duration: reuse T-109's fallback convention, don't re-decide it.
    reel_duration = ctx.job.duration
    duration_fallback_used = reel_duration is None
    if reel_duration is None:
        reel_duration = FALLBACK_REEL_DURATION_S

    # Reel dims/fps: fall back to the golden's resolution if unset (D-049).
    reel_dims_fallback_used = (
        ctx.job.width is None or ctx.job.height is None or ctx.job.fps is None
    )
    reel_width = ctx.job.width or _FALLBACK_REEL_WIDTH
    reel_height = ctx.job.height or _FALLBACK_REEL_HEIGHT
    reel_fps = ctx.job.fps or _FALLBACK_REEL_FPS

    now = (_now or (lambda: datetime.now(UTC)))()

    try:
        plan = EditPlan(
            schema_version=_SCHEMA_VERSION,
            job_id=ctx.job_id,
            brand_kit=ctx.job.brand_kit,
            reel=Reel(width=reel_width, height=reel_height, fps=reel_fps, duration=reel_duration),
            source=Source(video="input.mp4", audio="audio.wav"),
            captions=captions,
            visuals=visuals,
            motion=motion,
            audio=audio_plan,
            beats=[float(b) for b in beats_raw],
            meta=Meta(
                summary=understanding.summary,
                brief=ctx.job.brief,
                generated_at=now.isoformat(),
                # Only images.json's cost is tracked today; ASR/understanding
                # costs are NOT tracked yet (a known gap — see PROGRESS.md).
                # Music selection has no API cost. Aggregation = images cost.
                cost_estimate_usd=images_cost_usd,
            ),
        )
    except Exception as exc:
        raise AssembleError(f"Assembled plan failed EditPlan schema validation: {exc}") from exc

    try:
        validate_edit_plan(
            plan,
            known_templates=V1_TEMPLATE_NAMES,
            check_assets=True,
            job_dir=job_dir,
        )
    except EditPlanValidationError as exc:
        raise AssembleError(f"Assembled plan failed external validation: {exc}") from exc

    out = job_dir / "edit_plan.json"
    out.write_text(
        json.dumps(plan.model_dump(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    elapsed = time.monotonic() - t0
    ctx.logger.log_stage(
        "assemble_plan",
        elapsed,
        captions=len(captions),
        visuals=len(visuals),
        dropped=len(dropped_ids),
        dropped_ids=dropped_ids,
        motion=len(motion),
        beats=len(beats_raw),
        duration_fallback_used=duration_fallback_used,
        reel_dims_fallback_used=reel_dims_fallback_used,
    )
