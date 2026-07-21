"""Tests for the Edit Plan assembly + validation stage (T-112).

No network/API calls. All upstream job-root artifacts are built as in-test
fixture dicts (words/understanding/visual_plan/images/music/beats) plus tiny
stub asset files so check_assets=True can pass.
"""

from __future__ import annotations

import asyncio
import functools
import json
from datetime import UTC, datetime
from pathlib import Path

import pytest

from app.jobs.joblog import JobLogger
from app.jobs.manager import JobContext, JobManager, Stage
from app.jobs.paths import WorkspacePaths
from app.models.edit_plan import EditPlan
from app.models.job import JobState
from app.models.validate import validate_edit_plan
from app.pipeline.assemble_plan import (
    V1_TEMPLATE_NAMES,
    AssembleError,
    run_assemble_plan,
)

REEL_DURATION = 8.0
BEATS = [round(i * 0.4, 2) for i in range(21)]  # 0.0 .. 8.0

WORDS = [
    {"word": "Salam", "script": "latin", "start": 0.0, "end": 0.5, "segment_index": 0},
    {"word": "بزاف", "script": "arabic", "start": 0.5, "end": 1.0, "segment_index": 0},
    {"word": "promo", "script": "latin", "start": 3.0, "end": 3.5, "segment_index": 1},
    {"word": "vibes", "script": "latin", "start": 3.5, "end": 4.0, "segment_index": 1},
]

UNDERSTANDING = {
    "summary": "Cozy product promo.",
    "segments": [
        {
            "index": 0,
            "text": "Salam بزاف",
            "start": 0.0,
            "end": 3.0,
            "visual_intent": "speaker only",
            "emphasis_word_indices": [1],
        },
        {
            "index": 1,
            "text": "promo vibes",
            "start": 3.0,
            "end": 6.0,
            "visual_intent": "product on a table",
            "emphasis_word_indices": [2],
        },
    ],
}


def _visual(**overrides) -> dict:
    base = {
        "id": "v1",
        "kind": "generated_image",
        "asset": "assets/images/v1.png",
        "text": None,
        "template": "image_reveal_slideup",
        "start": 3.2,
        "end": 6.0,
        "beat_aligned": True,
    }
    base.update(overrides)
    return base


VISUAL_PLAN = {
    "seed": 1,
    "reel_duration": REEL_DURATION,
    "reel_duration_fallback_used": False,
    "visuals": [
        _visual(id="v1", asset="assets/images/v1.png", start=3.2, end=6.0),
        _visual(
            id="v2",
            kind="client_asset",
            asset="assets/client/product.png",
            template="image_reveal_scalein",
            start=6.4,
            end=7.6,
        ),
        _visual(
            id="v3",
            kind="animated_text",
            asset=None,
            text="300 DH",
            template="animtext_bold",
            start=7.6,
            end=8.0,
        ),
    ],
    "motion": [
        {"kind": "punch_in", "template": "punch_soft", "at": 0.4, "target": "speaker", "amount": 1.08},
        {"kind": "transition", "template": "transition_whip_pan", "at": 6.4},
        {"kind": "transition", "template": "transition_whip_pan", "at": 7.6},
    ],
}

IMAGES = {
    "images": [
        {
            "visual_id": "v1",
            "kind": "generated_image",
            "status": "generated",
            "asset": "assets/images/v1.png",
            "model": "gemini-3.1-flash-image",
            "prompt_hash": "abc123",
        },
        {
            "visual_id": "v2",
            "kind": "client_asset",
            "status": "reframed",
            "source_asset": "assets/client/product.png",
            "asset": "assets/client/product_9x16.png",
        },
        {"visual_id": "v3", "kind": "animated_text", "status": "skipped_no_image"},
    ],
    "generated": 1,
    "cached": 0,
    "client_reframed": 1,
    "skipped_ceiling": 0,
    "cost_estimate_usd": 0.04,
}

MUSIC = {
    "music": {"asset": "assets/audio/track.wav", "gain_db": -14.0, "start": 0.0},
    "sfx": [],
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _fixed_clock() -> datetime:
    return datetime(2026, 7, 21, 12, 0, 0, tzinfo=UTC)


def _write_stub_assets(job_dir: Path, *, include_v1: bool = True, include_v2: bool = True) -> None:
    (job_dir / "input.mp4").write_bytes(b"fake-mp4")
    (job_dir / "audio.wav").write_bytes(b"fake-wav")
    (job_dir / "assets" / "audio").mkdir(parents=True, exist_ok=True)
    (job_dir / "assets" / "audio" / "track.wav").write_bytes(b"fake-track")
    if include_v1:
        (job_dir / "assets" / "images").mkdir(parents=True, exist_ok=True)
        (job_dir / "assets" / "images" / "v1.png").write_bytes(b"fake-png")
    if include_v2:
        (job_dir / "assets" / "client").mkdir(parents=True, exist_ok=True)
        (job_dir / "assets" / "client" / "product_9x16.png").write_bytes(b"fake-png")


def _write_inputs(
    job_dir: Path,
    *,
    words: list | None = None,
    understanding: dict | None = None,
    visual_plan: dict | None = None,
    images: dict | None = None,
    music: dict | None = None,
    beats: list | None = None,
) -> None:
    (job_dir / "words.json").write_text(json.dumps(words if words is not None else WORDS), encoding="utf-8")
    (job_dir / "understanding.json").write_text(
        json.dumps(understanding if understanding is not None else UNDERSTANDING), encoding="utf-8"
    )
    (job_dir / "visual_plan.json").write_text(
        json.dumps(visual_plan if visual_plan is not None else VISUAL_PLAN), encoding="utf-8"
    )
    (job_dir / "images.json").write_text(
        json.dumps(images if images is not None else IMAGES), encoding="utf-8"
    )
    (job_dir / "music.json").write_text(json.dumps(music if music is not None else MUSIC), encoding="utf-8")
    (job_dir / "beats.json").write_text(json.dumps(beats if beats is not None else BEATS), encoding="utf-8")


def _make_ctx(tmp_path: Path, *, brief: str = "cozy promo", duration=REEL_DURATION) -> JobContext:
    jobs_root = tmp_path / "jobs"
    mgr = JobManager(jobs_root=jobs_root)
    job = mgr.create("kitA", brief)
    if duration is not None:
        mgr._jobs[job.job_id].duration = duration
        mgr._jobs[job.job_id].width = 1080
        mgr._jobs[job.job_id].height = 1920
        mgr._jobs[job.job_id].fps = 30
    paths = WorkspacePaths(jobs_root, job.job_id)
    logger = JobLogger(paths.log_path)
    return JobContext(
        job_id=job.job_id,
        paths=paths,
        job=mgr._jobs[job.job_id],
        logger=logger,
        settings=mgr_settings(),
    )


def mgr_settings():
    from app.config import Settings

    return Settings(_env_file="/nonexistent/.env")  # type: ignore[arg-type]


def _make_stage(now=None) -> Stage:
    return Stage(name="assemble_plan", run=functools.partial(run_assemble_plan, _now=now))


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------


def test_happy_path_assembles_valid_edit_plan(tmp_path: Path) -> None:
    ctx = _make_ctx(tmp_path)
    _write_inputs(ctx.paths.job_dir)
    _write_stub_assets(ctx.paths.job_dir)

    asyncio.run(run_assemble_plan(ctx, _now=_fixed_clock))

    out = ctx.paths.job_dir / "edit_plan.json"
    assert out.exists()
    data = json.loads(out.read_text(encoding="utf-8"))

    plan = EditPlan.model_validate(data)
    validate_edit_plan(plan, known_templates=V1_TEMPLATE_NAMES, check_assets=True, job_dir=ctx.paths.job_dir)


# ---------------------------------------------------------------------------
# Captions: grouping, emphasis, bidi
# ---------------------------------------------------------------------------


def test_captions_grouped_with_emphasis_and_bidi_preserved(tmp_path: Path) -> None:
    ctx = _make_ctx(tmp_path)
    _write_inputs(ctx.paths.job_dir)
    _write_stub_assets(ctx.paths.job_dir)
    asyncio.run(run_assemble_plan(ctx, _now=_fixed_clock))

    data = json.loads((ctx.paths.job_dir / "edit_plan.json").read_text(encoding="utf-8"))
    captions = data["captions"]
    assert len(captions) == 2

    seg0 = next(c for c in captions if c["segment_index"] == 0)
    assert seg0["template"] == "caption_karaoke_default"
    assert [w["text"] for w in seg0["words"]] == ["Salam", "بزاف"]
    # global index 1 ("بزاف") is emphasized per understanding.json seg 0.
    assert seg0["words"][0]["emphasis"] is False
    assert seg0["words"][1]["emphasis"] is True
    # Arabic preserved in logical codepoint order — exact string match, not display.
    assert seg0["words"][1]["text"] == "بزاف"
    assert seg0["words"][1]["text"] == "بزاف"

    seg1 = next(c for c in captions if c["segment_index"] == 1)
    assert [w["text"] for w in seg1["words"]] == ["promo", "vibes"]
    # global index 2 ("promo") is emphasized per understanding.json seg 1.
    assert seg1["words"][0]["emphasis"] is True
    assert seg1["words"][1]["emphasis"] is False


def test_overlapping_words_fail_loud(tmp_path: Path) -> None:
    ctx = _make_ctx(tmp_path)
    bad_words = [
        {"word": "a", "script": "latin", "start": 0.0, "end": 1.0, "segment_index": 0},
        {"word": "b", "script": "latin", "start": 0.5, "end": 1.5, "segment_index": 0},
    ]
    _write_inputs(ctx.paths.job_dir, words=bad_words)
    _write_stub_assets(ctx.paths.job_dir)

    with pytest.raises(AssembleError, match="fail-loud"):
        asyncio.run(run_assemble_plan(ctx, _now=_fixed_clock))
    assert not (ctx.paths.job_dir / "edit_plan.json").exists()


# ---------------------------------------------------------------------------
# Asset reconciliation
# ---------------------------------------------------------------------------


def test_ceiling_skipped_visual_dropped_and_transition_removed(tmp_path: Path) -> None:
    ctx = _make_ctx(tmp_path)
    visual_plan = {
        "seed": 1,
        "reel_duration": REEL_DURATION,
        "reel_duration_fallback_used": False,
        "visuals": [
            _visual(id="v1", asset="assets/images/v1.png", start=0.4, end=3.0),
            _visual(id="v2", asset="assets/images/v2.png", start=3.2, end=5.6),
            _visual(id="v3", asset="assets/images/v3.png", start=6.0, end=8.0),
        ],
        "motion": [
            {"kind": "transition", "template": "transition_whip_pan", "at": 3.2},
            {"kind": "transition", "template": "transition_whip_pan", "at": 6.0},
        ],
    }
    images = {
        "images": [
            {"visual_id": "v1", "kind": "generated_image", "status": "generated", "asset": "assets/images/v1.png"},
            {"visual_id": "v2", "kind": "generated_image", "status": "skipped_ceiling", "asset": "assets/images/v2.png"},
            {"visual_id": "v3", "kind": "generated_image", "status": "generated", "asset": "assets/images/v3.png"},
        ],
        "generated": 2,
        "cached": 0,
        "client_reframed": 0,
        "skipped_ceiling": 1,
        "cost_estimate_usd": 0.08,
    }
    _write_inputs(ctx.paths.job_dir, visual_plan=visual_plan, images=images)
    (ctx.paths.job_dir / "input.mp4").write_bytes(b"x")
    (ctx.paths.job_dir / "audio.wav").write_bytes(b"x")
    (ctx.paths.job_dir / "assets" / "audio").mkdir(parents=True, exist_ok=True)
    (ctx.paths.job_dir / "assets" / "audio" / "track.wav").write_bytes(b"x")
    (ctx.paths.job_dir / "assets" / "images").mkdir(parents=True, exist_ok=True)
    (ctx.paths.job_dir / "assets" / "images" / "v1.png").write_bytes(b"x")
    (ctx.paths.job_dir / "assets" / "images" / "v3.png").write_bytes(b"x")
    # NOTE: v2.png intentionally NOT created — it was ceiling-skipped and must be dropped.

    asyncio.run(run_assemble_plan(ctx, _now=_fixed_clock))

    data = json.loads((ctx.paths.job_dir / "edit_plan.json").read_text(encoding="utf-8"))
    visual_ids = {v["id"] for v in data["visuals"]}
    assert visual_ids == {"v1", "v3"}

    transition_times = {m["at"] for m in data["motion"] if m["kind"] == "transition"}
    assert 3.2 not in transition_times  # tied to dropped v2's start
    assert 6.0 in transition_times  # v3 survives, its transition stays


def test_reframed_client_asset_path_used(tmp_path: Path) -> None:
    ctx = _make_ctx(tmp_path)
    _write_inputs(ctx.paths.job_dir)
    _write_stub_assets(ctx.paths.job_dir)
    asyncio.run(run_assemble_plan(ctx, _now=_fixed_clock))

    data = json.loads((ctx.paths.job_dir / "edit_plan.json").read_text(encoding="utf-8"))
    v2 = next(v for v in data["visuals"] if v["id"] == "v2")
    assert v2["asset"] == "assets/client/product_9x16.png"


# ---------------------------------------------------------------------------
# Template validation
# ---------------------------------------------------------------------------


def test_only_v1_templates_used(tmp_path: Path) -> None:
    ctx = _make_ctx(tmp_path)
    _write_inputs(ctx.paths.job_dir)
    _write_stub_assets(ctx.paths.job_dir)
    asyncio.run(run_assemble_plan(ctx, _now=_fixed_clock))

    data = json.loads((ctx.paths.job_dir / "edit_plan.json").read_text(encoding="utf-8"))
    used = {c["template"] for c in data["captions"]}
    used |= {v["template"] for v in data["visuals"]}
    used |= {m["template"] for m in data["motion"]}
    assert used <= V1_TEMPLATE_NAMES


def test_unknown_template_rejected(tmp_path: Path) -> None:
    ctx = _make_ctx(tmp_path)
    bad_plan = json.loads(json.dumps(VISUAL_PLAN))
    bad_plan["visuals"][0]["template"] = "image_reveal_zoom"
    _write_inputs(ctx.paths.job_dir, visual_plan=bad_plan)
    _write_stub_assets(ctx.paths.job_dir)

    with pytest.raises(AssembleError, match="template"):
        asyncio.run(run_assemble_plan(ctx, _now=_fixed_clock))
    assert not (ctx.paths.job_dir / "edit_plan.json").exists()


# ---------------------------------------------------------------------------
# Fail-loud: broken references
# ---------------------------------------------------------------------------


def test_missing_asset_for_non_skipped_visual_fails(tmp_path: Path) -> None:
    ctx = _make_ctx(tmp_path)
    _write_inputs(ctx.paths.job_dir)
    (ctx.paths.job_dir / "input.mp4").write_bytes(b"x")
    (ctx.paths.job_dir / "audio.wav").write_bytes(b"x")
    (ctx.paths.job_dir / "assets" / "audio").mkdir(parents=True, exist_ok=True)
    (ctx.paths.job_dir / "assets" / "audio" / "track.wav").write_bytes(b"x")
    (ctx.paths.job_dir / "assets" / "client").mkdir(parents=True, exist_ok=True)
    (ctx.paths.job_dir / "assets" / "client" / "product_9x16.png").write_bytes(b"x")
    # v1.png (status="generated") is intentionally NOT created -> check_assets must fail.

    with pytest.raises(AssembleError, match="[Mm]issing"):
        asyncio.run(run_assemble_plan(ctx, _now=_fixed_clock))
    assert not (ctx.paths.job_dir / "edit_plan.json").exists()


def test_out_of_range_window_fails(tmp_path: Path) -> None:
    ctx = _make_ctx(tmp_path)
    bad_plan = json.loads(json.dumps(VISUAL_PLAN))
    bad_plan["visuals"][2]["end"] = 999.0  # v3 end far beyond reel_duration=8.0
    _write_inputs(ctx.paths.job_dir, visual_plan=bad_plan)
    _write_stub_assets(ctx.paths.job_dir)

    with pytest.raises(AssembleError):
        asyncio.run(run_assemble_plan(ctx, _now=_fixed_clock))
    assert not (ctx.paths.job_dir / "edit_plan.json").exists()


def test_missing_input_file_raises(tmp_path: Path) -> None:
    ctx = _make_ctx(tmp_path)
    _write_inputs(ctx.paths.job_dir)
    _write_stub_assets(ctx.paths.job_dir)
    (ctx.paths.job_dir / "music.json").unlink()

    with pytest.raises(AssembleError, match="music.json"):
        asyncio.run(run_assemble_plan(ctx, _now=_fixed_clock))
    assert not (ctx.paths.job_dir / "edit_plan.json").exists()


# ---------------------------------------------------------------------------
# Meta / cost aggregation
# ---------------------------------------------------------------------------


def test_meta_fields_and_cost_aggregation(tmp_path: Path) -> None:
    ctx = _make_ctx(tmp_path, brief="cozy product promo")
    _write_inputs(ctx.paths.job_dir)
    _write_stub_assets(ctx.paths.job_dir)
    asyncio.run(run_assemble_plan(ctx, _now=_fixed_clock))

    data = json.loads((ctx.paths.job_dir / "edit_plan.json").read_text(encoding="utf-8"))
    meta = data["meta"]
    assert meta["summary"] == "Cozy product promo."
    assert meta["brief"] == "cozy product promo"
    assert meta["generated_at"] == _fixed_clock().isoformat()
    assert meta["cost_estimate_usd"] == pytest.approx(0.04)


# ---------------------------------------------------------------------------
# Determinism
# ---------------------------------------------------------------------------


def test_determinism_same_inputs_byte_identical(tmp_path: Path) -> None:
    ctx_a = _make_ctx(tmp_path / "a")
    ctx_b = _make_ctx(tmp_path / "b")
    for ctx in (ctx_a, ctx_b):
        _write_inputs(ctx.paths.job_dir)
        _write_stub_assets(ctx.paths.job_dir)

    asyncio.run(run_assemble_plan(ctx_a, _now=_fixed_clock))
    asyncio.run(run_assemble_plan(ctx_b, _now=_fixed_clock))

    raw_a = (ctx_a.paths.job_dir / "edit_plan.json").read_text(encoding="utf-8")
    raw_b = (ctx_b.paths.job_dir / "edit_plan.json").read_text(encoding="utf-8")
    # job_id differs between the two jobs -> normalize it out before comparing.
    data_a = json.loads(raw_a)
    data_b = json.loads(raw_b)
    data_a["job_id"] = data_b["job_id"] = "NORMALIZED"
    assert json.dumps(data_a, sort_keys=True) == json.dumps(data_b, sort_keys=True)


# ---------------------------------------------------------------------------
# Runner integration
# ---------------------------------------------------------------------------


def test_runs_through_runner_and_writes_artifact(tmp_path: Path) -> None:
    jobs_root = tmp_path / "jobs"
    mgr = JobManager(jobs_root=jobs_root)
    job = mgr.create("kitA", "cozy promo")
    mgr._jobs[job.job_id].duration = REEL_DURATION
    mgr._jobs[job.job_id].width = 1080
    mgr._jobs[job.job_id].height = 1920
    mgr._jobs[job.job_id].fps = 30
    job_dir = jobs_root / job.job_id
    _write_inputs(job_dir)
    _write_stub_assets(job_dir)

    stage = _make_stage(now=_fixed_clock)
    asyncio.run(mgr.run_pipeline(job.job_id, [stage]))

    status = mgr.status(job.job_id)
    assert status.state == JobState.READY_FOR_AE
    assert status.progress_pct == 100.0
    assert (job_dir / "edit_plan.json").exists()
