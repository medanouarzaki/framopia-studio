"""Visual planning stage — spec Stage 7 / §12.1.

Reads job_dir/understanding.json (T-108) and job_dir/beats.json (T-109),
enumerates client assets (ctx.paths.client_dir, copied by ingest T-102 / D-015),
and deterministically produces the concrete visual + motion track — NO Gemini
calls, NO randomness beyond a recorded, reproducible seed.

Output: job_dir/visual_plan.json (job root, D-021; placement logged in D-039):

    {
      "seed": <int>,
      "reel_duration": <float>,
      "reel_duration_fallback_used": <bool>,
      "visuals": [Visual, ...],
      "motion": [Motion, ...]
    }

Ordering note (spec Stage 7 ordering): this stage MUST run after "music"
(T-109) in the pipeline's stage list, since it snaps every visual start to
job_dir/beats.json produced there. T-111 (image generation) later fills the
``generated_image`` assets this stage names (file need not exist yet — only
validate_edit_plan(check_assets=True) at T-112 assembly checks that). T-112
assembles the full Edit Plan; this stage's Visual/Motion instances are reused
directly (D-038).

## Injection seam for tests

``run_plan_visuals`` accepts an optional ``_seed`` keyword argument to make
the seed-driven template-variety choice explicit and reproducible across
separate jobs with identical fixture inputs. Leave it None in production
(the seed is derived deterministically from ``ctx.job_id``).
"""

from __future__ import annotations

import hashlib
import json
import re
import time
from pathlib import Path
from random import Random

from app.jobs.manager import JobContext
from app.models.edit_plan import Motion, Visual
from app.models.understanding import Understanding, UnderstandingSegment
from app.pipeline.music import _FALLBACK_REEL_DURATION_S as FALLBACK_REEL_DURATION_S

# V1 template-name set (BUILD_STATE §6) — the ONLY template names this stage
# may emit. `transition_whip_pan`, NOT the bare `whip_pan` (D-007).
_IMAGE_REVEAL_TEMPLATES = ("image_reveal_slideup", "image_reveal_scalein")
_ANIMTEXT_TEMPLATE = "animtext_bold"
_PUNCH_TEMPLATE = "punch_soft"
_TRANSITION_TEMPLATE = "transition_whip_pan"

# Minimum on-screen duration for any visual so the reveal never strobes (D-040).
MIN_VISUAL_DURATION_S = 1.5

# Punch-in amount for speaker-only key moments (spec §13.3 "subtle").
_PUNCH_AMOUNT = 1.08

# Sentinel from D-035 — segments with this exact visual_intent get no B-roll.
_SPEAKER_ONLY_INTENT = "speaker only"

# Keywords/patterns that imply a short text card (price/number/stat) is a
# better fit than a generated concept image (D-039).
_TEXT_CARD_KEYWORDS = (
    "price", "discount", "promo code", "% off", "percent", "stat", "quote", "number",
)
_DIGIT_RE = re.compile(r"\d")

_WORD_RE = re.compile(r"[a-zA-Z0-9؀-ۿ]{3,}")


class PlanVisualsError(RuntimeError):
    """Raised when the visual-planning stage fails.

    The message is human-readable and safe to surface to the operator.
    """


def _tokenize(text: str) -> set[str]:
    """Lowercase word tokens (len >= 3) for deterministic keyword-overlap matching."""
    return {m.group(0).lower() for m in _WORD_RE.finditer(text)}


def _looks_like_text_card(visual_intent: str) -> bool:
    """Deterministic heuristic: does this intent describe a price/number/stat card?"""
    if _DIGIT_RE.search(visual_intent):
        return True
    lowered = visual_intent.lower()
    return any(keyword in lowered for keyword in _TEXT_CARD_KEYWORDS)


def _find_client_asset(visual_intent: str, client_files: list[Path]) -> Path | None:
    """Return the first client asset (sorted, deterministic) whose filename tokens
    overlap the segment's visual_intent tokens."""
    intent_tokens = _tokenize(visual_intent)
    if not intent_tokens:
        return None
    for f in client_files:
        if _tokenize(f.stem) & intent_tokens:
            return f
    return None


def _snap_start_on_or_after(beats: list[float], t: float) -> float | None:
    """Return the smallest beat >= t, or None if no such beat exists."""
    for b in beats:
        if b >= t:
            return b
    return None


def _classify(
    segment: UnderstandingSegment, client_files: list[Path]
) -> tuple[str, Path | None]:
    """Apply the spec §12.1 decision order. Returns (kind, client_asset_or_None).

    kind is one of: "client_asset", "generated_image", "animated_text", "none".
    """
    client_match = _find_client_asset(segment.visual_intent, client_files)
    if client_match is not None:
        return "client_asset", client_match
    if segment.visual_intent.strip().lower() == _SPEAKER_ONLY_INTENT:
        return "none", None
    if _looks_like_text_card(segment.visual_intent):
        return "animated_text", None
    return "generated_image", None


async def run_plan_visuals(
    ctx: JobContext,
    *,
    _seed: int | None = None,
) -> None:
    """Visual-planning stage entry point.

    Called by the T-101 stage runner via Stage(name="plan_visuals", run=run_plan_visuals).
    Raises PlanVisualsError on any failure so the runner sets job state to ERROR.
    Deterministic and makes NO network/API calls.

    Args:
        ctx:    Job context from the runner.
        _seed:  Injectable seed for template-variety selection. Leave None in
                production (derived deterministically from ctx.job_id).
    """
    t0 = time.monotonic()

    # ------------------------------------------------------------------
    # 1. Read required inputs
    # ------------------------------------------------------------------
    understanding_path = ctx.paths.job_dir / "understanding.json"
    beats_path = ctx.paths.job_dir / "beats.json"

    if not understanding_path.exists() or not understanding_path.is_file():
        raise PlanVisualsError(
            f"understanding.json not found at {understanding_path}. "
            "Run the understanding stage (T-108) before visual planning."
        )
    if not beats_path.exists() or not beats_path.is_file():
        raise PlanVisualsError(
            f"beats.json not found at {beats_path}. "
            "Run the music-selection stage (T-109) before visual planning."
        )

    try:
        understanding = Understanding.model_validate_json(
            understanding_path.read_text(encoding="utf-8")
        )
    except Exception as exc:
        raise PlanVisualsError(f"Could not read/validate understanding.json: {exc}") from exc

    try:
        beats: list[float] = json.loads(beats_path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise PlanVisualsError(f"Could not read beats.json: {exc}") from exc

    if not isinstance(beats, list) or not beats:
        raise PlanVisualsError("beats.json must be a non-empty JSON array of beat timestamps.")
    beats = sorted(float(b) for b in beats)

    # ------------------------------------------------------------------
    # 2. Reel duration (fallback shared with T-109's convention)
    # ------------------------------------------------------------------
    reel_duration = ctx.job.duration
    duration_fallback_used = reel_duration is None
    if reel_duration is None:
        reel_duration = FALLBACK_REEL_DURATION_S

    # ------------------------------------------------------------------
    # 3. Enumerate client assets (sorted for determinism)
    # ------------------------------------------------------------------
    client_files: list[Path] = []
    if ctx.paths.client_dir.exists():
        client_files = sorted(p for p in ctx.paths.client_dir.iterdir() if p.is_file())

    # ------------------------------------------------------------------
    # 4. Seed for reproducible template variety (D-039)
    # ------------------------------------------------------------------
    seed = _seed if _seed is not None else int(
        hashlib.sha256(ctx.job_id.encode("utf-8")).hexdigest()[:8], 16
    )
    rng = Random(seed)

    # ------------------------------------------------------------------
    # 5. Classify each segment, then place windows on the beat grid
    # ------------------------------------------------------------------
    segments = sorted(understanding.segments, key=lambda s: s.start)

    visuals: list[Visual] = []
    no_visual_segments: list[UnderstandingSegment] = []
    cursor = 0.0
    visual_counter = 0

    for seg in segments:
        kind, client_asset = _classify(seg, client_files)
        if kind == "none":
            no_visual_segments.append(seg)
            continue

        desired_start = max(seg.start, cursor)
        start = _snap_start_on_or_after(beats, desired_start)
        if start is None or start >= reel_duration:
            # Nothing left to fit this visual into — density sanity: drop it,
            # the speaker stays on screen rather than forcing an out-of-range window.
            no_visual_segments.append(seg)
            continue

        end = min(seg.end, reel_duration)
        if end - start < MIN_VISUAL_DURATION_S:
            end = start + MIN_VISUAL_DURATION_S
        if end > reel_duration:
            no_visual_segments.append(seg)
            continue

        visual_counter += 1
        vid = f"v{visual_counter}"

        if kind == "client_asset":
            template = _IMAGE_REVEAL_TEMPLATES[rng.randrange(len(_IMAGE_REVEAL_TEMPLATES))]
            visuals.append(
                Visual(
                    id=vid,
                    kind="client_asset",
                    asset=f"assets/client/{client_asset.name}",
                    template=template,
                    start=start,
                    end=end,
                    beat_aligned=True,
                )
            )
        elif kind == "generated_image":
            template = _IMAGE_REVEAL_TEMPLATES[rng.randrange(len(_IMAGE_REVEAL_TEMPLATES))]
            visuals.append(
                Visual(
                    id=vid,
                    kind="generated_image",
                    asset=f"assets/images/{vid}.png",
                    template=template,
                    start=start,
                    end=end,
                    beat_aligned=True,
                )
            )
        else:  # animated_text
            visuals.append(
                Visual(
                    id=vid,
                    kind="animated_text",
                    text=seg.visual_intent,
                    template=_ANIMTEXT_TEMPLATE,
                    start=start,
                    end=end,
                    beat_aligned=True,
                )
            )

        cursor = end

    # ------------------------------------------------------------------
    # 6. Motion: punch-ins on speaker-only moments, whip-pan at visual boundaries
    #    (D-041 — placement rule)
    # ------------------------------------------------------------------
    motion: list[Motion] = []
    for seg in no_visual_segments:
        beat = min(beats, key=lambda b: abs(b - seg.start))
        motion.append(
            Motion(
                kind="punch_in",
                template=_PUNCH_TEMPLATE,
                at=beat,
                target="speaker",
                amount=_PUNCH_AMOUNT,
            )
        )
    for v in visuals[1:]:
        motion.append(Motion(kind="transition", template=_TRANSITION_TEMPLATE, at=v.start))

    motion.sort(key=lambda m: (m.at, m.kind))

    # ------------------------------------------------------------------
    # 7. Write visual_plan.json at the job root (D-039)
    # ------------------------------------------------------------------
    out = ctx.paths.job_dir / "visual_plan.json"
    payload = {
        "seed": seed,
        "reel_duration": reel_duration,
        "reel_duration_fallback_used": duration_fallback_used,
        "visuals": [v.model_dump() for v in visuals],
        "motion": [m.model_dump() for m in motion],
    }
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    # ------------------------------------------------------------------
    # 8. Log (no secrets)
    # ------------------------------------------------------------------
    elapsed = time.monotonic() - t0
    ctx.logger.log_stage(
        "plan_visuals",
        elapsed,
        visuals=len(visuals),
        motion=len(motion),
        reel_duration_fallback_used=duration_fallback_used,
    )
