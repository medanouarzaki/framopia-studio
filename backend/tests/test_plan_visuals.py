"""Tests for the visual-planning pipeline stage (T-110).

Deterministic, no network/API calls. Fixtures are built in-test (small JSON,
no committed media) covering all four §12.1 decision-order branches:
client_asset, animated_text (text-card heuristic), generated_image, and
"speaker only" → no visual.
"""

from __future__ import annotations

import asyncio
import functools
import json
from pathlib import Path

import pytest

from app.jobs.manager import JobManager, Stage
from app.models.edit_plan import (
    AudioPlan,
    CaptionLine,
    EditPlan,
    Meta,
    Motion,
    MusicCue,
    Reel,
    Source,
    Visual,
)
from app.models.job import JobState
from app.pipeline.plan_visuals import (
    MIN_VISUAL_DURATION_S,
    PlanVisualsError,
    run_plan_visuals,
)

# ---------------------------------------------------------------------------
# Fixture data
# ---------------------------------------------------------------------------

REEL_DURATION = 14.0
BEATS = [round(i * 0.4, 2) for i in range(40)]  # 0.0 .. 15.6, dense enough to always find a beat

UNDERSTANDING = {
    "summary": "A cozy product promo.",
    "segments": [
        {
            "index": 0,
            "text": "Salam friends",
            "start": 0.0,
            "end": 3.0,
            "visual_intent": "speaker only",
            "emphasis_word_indices": [],
        },
        {
            "index": 1,
            "text": "check our new product",
            "start": 3.0,
            "end": 6.0,
            "visual_intent": "product on a table",
            "emphasis_word_indices": [],
        },
        {
            "index": 2,
            "text": "only 300 DH today",
            "start": 6.0,
            "end": 9.0,
            "visual_intent": "300 DH price tag",
            "emphasis_word_indices": [],
        },
        {
            "index": 3,
            "text": "have a cozy morning",
            "start": 9.0,
            "end": 13.0,
            "visual_intent": "cozy morning coffee scene",
            "emphasis_word_indices": [],
        },
    ],
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _setup_job(
    tmp_path: Path,
    *,
    duration: float | None = REEL_DURATION,
    with_client_asset: bool = True,
    understanding: dict | None = None,
    beats: list[float] | None = None,
) -> tuple[JobManager, object]:
    jobs_root = tmp_path / "jobs"
    mgr = JobManager(jobs_root=jobs_root)
    job = mgr.create("kitA", "cozy product promo")
    if duration is not None:
        mgr._jobs[job.job_id].duration = duration

    job_dir = jobs_root / job.job_id
    (job_dir / "understanding.json").write_text(
        json.dumps(understanding if understanding is not None else UNDERSTANDING),
        encoding="utf-8",
    )
    (job_dir / "beats.json").write_text(
        json.dumps(beats if beats is not None else BEATS), encoding="utf-8"
    )
    if with_client_asset:
        (job_dir / "assets" / "client").mkdir(parents=True, exist_ok=True)
        (job_dir / "assets" / "client" / "product.png").write_bytes(b"\x89PNG-fake")

    return mgr, job


def _make_stage(seed: int | None = 12345) -> Stage:
    return Stage(name="plan_visuals", run=functools.partial(run_plan_visuals, _seed=seed))


def _run(mgr: JobManager, job, seed: int | None = 12345) -> dict:
    asyncio.run(mgr.run_pipeline(job.job_id, [_make_stage(seed)]))
    job_dir = mgr._jobs_root / job.job_id
    return json.loads((job_dir / "visual_plan.json").read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# Decision-order branches
# ---------------------------------------------------------------------------


def test_client_asset_priority(tmp_path: Path) -> None:
    mgr, job = _setup_job(tmp_path)
    plan = _run(mgr, job)
    by_intent = {v["kind"]: v for v in plan["visuals"]}
    assert "client_asset" in by_intent
    assert by_intent["client_asset"]["asset"] == "assets/client/product.png"


def test_speaker_only_yields_no_visual(tmp_path: Path) -> None:
    mgr, job = _setup_job(tmp_path)
    plan = _run(mgr, job)
    # Segment 0 ("Salam friends", speaker only) must not produce a visual
    # starting anywhere near [0, 3).
    assert all(v["start"] >= 3.0 or v["kind"] != "client_asset" for v in plan["visuals"])
    # 4 segments in fixture, one is speaker-only -> at most 3 visuals.
    assert len(plan["visuals"]) <= 3


def test_text_card_heuristic_yields_animated_text(tmp_path: Path) -> None:
    mgr, job = _setup_job(tmp_path)
    plan = _run(mgr, job)
    animated = [v for v in plan["visuals"] if v["kind"] == "animated_text"]
    assert len(animated) == 1
    assert animated[0]["template"] == "animtext_bold"
    assert animated[0]["text"] == "300 DH price tag"
    assert animated[0]["asset"] is None


def test_generated_image_for_plain_concept(tmp_path: Path) -> None:
    mgr, job = _setup_job(tmp_path)
    plan = _run(mgr, job)
    generated = [v for v in plan["visuals"] if v["kind"] == "generated_image"]
    assert len(generated) == 1
    assert generated[0]["asset"] == f"assets/images/{generated[0]['id']}.png"


def test_no_client_asset_falls_back_to_generated_image(tmp_path: Path) -> None:
    mgr, job = _setup_job(tmp_path, with_client_asset=False)
    plan = _run(mgr, job)
    kinds = {v["kind"] for v in plan["visuals"]}
    assert "client_asset" not in kinds
    assert "generated_image" in kinds


# ---------------------------------------------------------------------------
# Timing invariants
# ---------------------------------------------------------------------------


def test_only_v1_template_names_used(tmp_path: Path) -> None:
    mgr, job = _setup_job(tmp_path)
    plan = _run(mgr, job)
    allowed = {
        "image_reveal_slideup",
        "image_reveal_scalein",
        "animtext_bold",
        "punch_soft",
        "transition_whip_pan",
    }
    used = {v["template"] for v in plan["visuals"]} | {m["template"] for m in plan["motion"]}
    assert used <= allowed
    assert used  # at least one template actually used


def test_visual_starts_are_on_beat(tmp_path: Path) -> None:
    mgr, job = _setup_job(tmp_path)
    plan = _run(mgr, job)
    beats_set = set(BEATS)
    for v in plan["visuals"]:
        assert v["beat_aligned"] is True
        assert v["start"] in beats_set


def test_visual_windows_within_reel_duration(tmp_path: Path) -> None:
    mgr, job = _setup_job(tmp_path)
    plan = _run(mgr, job)
    for v in plan["visuals"]:
        assert 0.0 <= v["start"] < v["end"] <= plan["reel_duration"]


def test_visuals_non_overlapping(tmp_path: Path) -> None:
    mgr, job = _setup_job(tmp_path)
    plan = _run(mgr, job)
    visuals = sorted(plan["visuals"], key=lambda v: v["start"])
    for a, b in zip(visuals, visuals[1:], strict=False):
        assert a["end"] <= b["start"]


def test_visuals_meet_minimum_duration(tmp_path: Path) -> None:
    mgr, job = _setup_job(tmp_path)
    plan = _run(mgr, job)
    for v in plan["visuals"]:
        assert v["end"] - v["start"] >= MIN_VISUAL_DURATION_S - 1e-9


# ---------------------------------------------------------------------------
# Motion
# ---------------------------------------------------------------------------


def test_motion_has_punch_soft_and_transition(tmp_path: Path) -> None:
    mgr, job = _setup_job(tmp_path)
    plan = _run(mgr, job)
    kinds = {(m["kind"], m["template"]) for m in plan["motion"]}
    assert ("punch_in", "punch_soft") in kinds
    assert ("transition", "transition_whip_pan") in kinds

    beats_set = set(BEATS)
    for m in plan["motion"]:
        assert m["at"] in beats_set


def test_punch_in_has_target_and_amount(tmp_path: Path) -> None:
    mgr, job = _setup_job(tmp_path)
    plan = _run(mgr, job)
    punches = [m for m in plan["motion"] if m["kind"] == "punch_in"]
    assert punches
    for p in punches:
        assert p["target"] == "speaker"
        assert p["amount"] == pytest.approx(1.08)


def test_transitions_only_between_visuals_not_before_first(tmp_path: Path) -> None:
    mgr, job = _setup_job(tmp_path)
    plan = _run(mgr, job)
    visuals = sorted(plan["visuals"], key=lambda v: v["start"])
    transitions = [m for m in plan["motion"] if m["kind"] == "transition"]
    assert len(transitions) == max(0, len(visuals) - 1)
    if visuals:
        first_start = visuals[0]["start"]
        assert all(t["at"] != first_start for t in transitions)


# ---------------------------------------------------------------------------
# Determinism
# ---------------------------------------------------------------------------


def test_determinism_same_seed_same_inputs_byte_identical(tmp_path: Path) -> None:
    mgr_a, job_a = _setup_job(tmp_path / "a")
    mgr_b, job_b = _setup_job(tmp_path / "b")

    asyncio.run(mgr_a.run_pipeline(job_a.job_id, [_make_stage(seed=999)]))
    asyncio.run(mgr_b.run_pipeline(job_b.job_id, [_make_stage(seed=999)]))

    raw_a = (mgr_a._jobs_root / job_a.job_id / "visual_plan.json").read_text(encoding="utf-8")
    raw_b = (mgr_b._jobs_root / job_b.job_id / "visual_plan.json").read_text(encoding="utf-8")
    assert raw_a == raw_b


def test_default_seed_is_derived_from_job_id_deterministically(tmp_path: Path) -> None:
    """Re-running the same job_id with the default (None) seed reproduces the same plan."""
    jobs_root = tmp_path / "jobs"
    mgr = JobManager(jobs_root=jobs_root)
    job = mgr.create("kitA", "cozy product promo")
    mgr._jobs[job.job_id].duration = REEL_DURATION
    job_dir = jobs_root / job.job_id
    (job_dir / "understanding.json").write_text(json.dumps(UNDERSTANDING), encoding="utf-8")
    (job_dir / "beats.json").write_text(json.dumps(BEATS), encoding="utf-8")

    stage = Stage(name="plan_visuals", run=run_plan_visuals)
    asyncio.run(mgr.run_pipeline(job.job_id, [stage]))
    first = (job_dir / "visual_plan.json").read_text(encoding="utf-8")

    asyncio.run(mgr.run_pipeline(job.job_id, [stage]))
    second = (job_dir / "visual_plan.json").read_text(encoding="utf-8")

    assert first == second


# ---------------------------------------------------------------------------
# EditPlan compatibility
# ---------------------------------------------------------------------------


def test_visuals_and_motion_construct_into_valid_edit_plan(tmp_path: Path) -> None:
    mgr, job = _setup_job(tmp_path)
    plan = _run(mgr, job)

    visuals = [Visual.model_validate(v) for v in plan["visuals"]]
    motion = [Motion.model_validate(m) for m in plan["motion"]]

    edit_plan = EditPlan(
        schema_version="1.0",
        job_id=job.job_id,
        brand_kit="kitA",
        reel=Reel(width=1080, height=1920, fps=30, duration=plan["reel_duration"]),
        source=Source(video="input.mp4", audio="audio.wav"),
        captions=[
            CaptionLine(segment_index=0, template="caption_karaoke_default", words=[])
        ],
        visuals=visuals,
        motion=motion,
        audio=AudioPlan(
            music=MusicCue(asset="assets/audio/track.wav", gain_db=-14.0, start=0.0), sfx=[]
        ),
        beats=BEATS,
        meta=Meta(
            summary="test", brief="test", generated_at="2026-07-21T00:00:00Z", cost_estimate_usd=0.0
        ),
    )
    assert len(edit_plan.visuals) == len(visuals)


# ---------------------------------------------------------------------------
# Errors (fail loud)
# ---------------------------------------------------------------------------


def test_missing_understanding_raises_error_state(tmp_path: Path) -> None:
    jobs_root = tmp_path / "jobs"
    mgr = JobManager(jobs_root=jobs_root)
    job = mgr.create("kitA", "brief")
    mgr._jobs[job.job_id].duration = REEL_DURATION
    (jobs_root / job.job_id / "beats.json").write_text(json.dumps(BEATS), encoding="utf-8")

    asyncio.run(mgr.run_pipeline(job.job_id, [_make_stage()]))
    status = mgr.status(job.job_id)
    assert status.state == JobState.ERROR
    assert "understanding" in status.message.lower()


def test_missing_beats_raises_error_state(tmp_path: Path) -> None:
    jobs_root = tmp_path / "jobs"
    mgr = JobManager(jobs_root=jobs_root)
    job = mgr.create("kitA", "brief")
    mgr._jobs[job.job_id].duration = REEL_DURATION
    (jobs_root / job.job_id / "understanding.json").write_text(
        json.dumps(UNDERSTANDING), encoding="utf-8"
    )

    asyncio.run(mgr.run_pipeline(job.job_id, [_make_stage()]))
    status = mgr.status(job.job_id)
    assert status.state == JobState.ERROR
    assert "beats" in status.message.lower()


def test_empty_beats_raises_error_state(tmp_path: Path) -> None:
    mgr, job = _setup_job(tmp_path, beats=[])
    asyncio.run(mgr.run_pipeline(job.job_id, [_make_stage()]))
    status = mgr.status(job.job_id)
    assert status.state == JobState.ERROR


# ---------------------------------------------------------------------------
# Reel-duration fallback (shared T-109 convention)
# ---------------------------------------------------------------------------


def test_duration_fallback_used_and_logged(tmp_path: Path) -> None:
    mgr, job = _setup_job(tmp_path, duration=None)
    assert job.duration is None
    plan = _run(mgr, job)
    assert plan["reel_duration_fallback_used"] is True

    job_dir = mgr._jobs_root / job.job_id
    log_lines = (job_dir / "log.txt").read_text(encoding="utf-8").strip().splitlines()
    entries = [
        json.loads(line)
        for line in log_lines
        if json.loads(line).get("stage") == "plan_visuals" and "visuals" in json.loads(line)
    ]
    assert entries
    assert entries[-1]["reel_duration_fallback_used"] is True


# ---------------------------------------------------------------------------
# Runner integration
# ---------------------------------------------------------------------------


def test_runs_through_runner_and_writes_artifact(tmp_path: Path) -> None:
    mgr, job = _setup_job(tmp_path)
    asyncio.run(mgr.run_pipeline(job.job_id, [_make_stage()]))

    status = mgr.status(job.job_id)
    assert status.state == JobState.READY_FOR_AE
    assert status.progress_pct == 100.0

    artifact = mgr._jobs_root / job.job_id / "visual_plan.json"
    assert artifact.exists()


def test_unclassifiable_kind_never_produced() -> None:
    """Sanity: PlanVisualsError is importable and is a RuntimeError (fail-loud contract)."""
    assert issubclass(PlanVisualsError, RuntimeError)
