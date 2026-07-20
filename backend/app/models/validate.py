"""External Edit Plan validator — checks requiring context unavailable at construction time.

In-plan rules (word timings, visual windows, beat alignment, kind/payload consistency) are
enforced by Pydantic model_validators in edit_plan.py. This module handles rules that need
external context: the template registry (T-202) and asset presence on disk (T-101+).
"""

from __future__ import annotations

from pathlib import Path

from app.models.edit_plan import EditPlan


class EditPlanValidationError(Exception):
    """Raised when an EditPlan fails external validation."""


def validate_edit_plan(
    plan: EditPlan,
    *,
    known_templates: set[str] | None = None,
    check_assets: bool = False,
    job_dir: str | Path | None = None,
) -> None:
    """Validate an EditPlan against external context.

    In-plan Pydantic rules are already enforced at construction. This function adds:
      - Template existence check: every template name in the plan must be in known_templates.
        If known_templates is None, the check is skipped (allows the golden to validate
        standalone before T-202 wires the real registry).
      - Asset existence check: every asset path must exist under job_dir.
        Skipped when check_assets=False (the default) so unit tests and the golden
        can validate without real media on disk.

    Args:
        plan: A fully constructed EditPlan (in-plan rules already checked).
        known_templates: Set of valid template names. None → skip template check.
        check_assets: If True, verify every referenced asset file exists on disk.
        job_dir: Root directory for resolving relative asset paths. Required when
                 check_assets=True.

    Raises:
        EditPlanValidationError: With a specific, actionable message on any failure.
    """
    _check_templates(plan, known_templates)
    if check_assets:
        _check_assets(plan, job_dir)


def _check_templates(plan: EditPlan, known_templates: set[str] | None) -> None:
    """Raise EditPlanValidationError if any template name is not in known_templates."""
    if known_templates is None:
        return

    used: set[str] = set()
    for caption in plan.captions:
        used.add(caption.template)
    for visual in plan.visuals:
        used.add(visual.template)
    for motion_item in plan.motion:
        used.add(motion_item.template)

    unknown = used - known_templates
    if unknown:
        raise EditPlanValidationError(
            f"Plan references template(s) not in the registry: {sorted(unknown)}"
        )


def _check_assets(plan: EditPlan, job_dir: str | Path | None) -> None:
    """Raise EditPlanValidationError if any referenced asset file is missing."""
    if job_dir is None:
        raise EditPlanValidationError(
            "check_assets=True requires job_dir to be provided"
        )
    base = Path(job_dir)

    candidates: list[str] = [
        plan.source.video,
        plan.source.audio,
        plan.audio.music.asset,
    ]
    for sfx in plan.audio.sfx:
        candidates.append(sfx.asset)
    for visual in plan.visuals:
        if visual.asset is not None:
            candidates.append(visual.asset)

    missing = [p for p in candidates if not (base / p).exists()]
    if missing:
        raise EditPlanValidationError(
            f"Missing asset file(s) under {base}: {missing}"
        )
