"""Tests for the image generation & sourcing pipeline stage (T-111).

All Gemini calls use the injection seam (GeminiClient(transport=...)) — no
real network. ffmpeg-dependent client-asset reframe tests synthesize tiny
images at test time and are skipped (not failed) when ffmpeg/ffprobe is
unavailable, mirroring test_audio.py's pattern.
"""

from __future__ import annotations

import asyncio
import base64
import functools
import json
import shutil
import subprocess
from pathlib import Path

import pytest

from app.clients.gemini import GeminiClient
from app.config import Settings
from app.jobs.joblog import JobLogger
from app.jobs.manager import JobContext, JobManager, Stage
from app.jobs.paths import WorkspacePaths
from app.models.job import JobState
from app.pipeline.images import (
    _DEFAULT_IMAGE_STYLE,
    _DEFAULT_NEGATIVE,
    ImagesError,
    _build_prompt,
    run_images,
)

_HAS_FFTOOLS = bool(shutil.which("ffmpeg")) and bool(shutil.which("ffprobe"))
skip_no_fftools = pytest.mark.skipif(
    not _HAS_FFTOOLS, reason="ffmpeg/ffprobe not available in this environment"
)

# ---------------------------------------------------------------------------
# Fixture data
# ---------------------------------------------------------------------------

UNDERSTANDING = {
    "summary": "A cozy product promo.",
    "segments": [
        {
            "index": 0,
            "text": "have a cozy morning",
            "start": 0.0,
            "end": 3.0,
            "visual_intent": "cozy morning coffee scene",
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
            "text": "another cozy shot",
            "start": 9.0,
            "end": 12.0,
            "visual_intent": "cozy morning coffee scene",
            "emphasis_word_indices": [],
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
        "start": 0.2,
        "end": 3.0,
        "beat_aligned": True,
    }
    base.update(overrides)
    return base


_V2_CLIENT_ASSET = _visual(
    id="v2",
    kind="client_asset",
    asset="assets/client/product.png",
    template="image_reveal_scalein",
    start=3.2,
    end=6.0,
)


def _visual_plan(*, with_client_asset: bool) -> dict:
    visuals = [
        _visual(id="v1", kind="generated_image", asset="assets/images/v1.png", start=0.2, end=3.0),
    ]
    if with_client_asset:
        visuals.append(_V2_CLIENT_ASSET)
    visuals.extend(
        [
            _visual(
                id="v3",
                kind="animated_text",
                asset=None,
                text="300 DH price tag",
                template="animtext_bold",
                start=6.2,
                end=9.0,
            ),
            _visual(id="v4", kind="generated_image", asset="assets/images/v4.png", start=9.2, end=12.0),
        ]
    )
    return {
        "seed": 1,
        "reel_duration": 12.0,
        "reel_duration_fallback_used": False,
        "visuals": visuals,
        "motion": [],
    }


VISUAL_PLAN = _visual_plan(with_client_asset=False)
VISUAL_PLAN_WITH_CLIENT_ASSET = _visual_plan(with_client_asset=True)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _key_safe_settings(**overrides) -> Settings:
    kwargs = {"_env_file": "/nonexistent/.env", "gemini_api_key": "test-key-for-images"}
    kwargs.update(overrides)
    return Settings(**kwargs)  # type: ignore[arg-type]


def _write_inputs(
    job_dir: Path, *, with_client_asset: bool = False, client_asset_dims: str = "800x800"
) -> None:
    (job_dir / "understanding.json").write_text(json.dumps(UNDERSTANDING), encoding="utf-8")
    plan = VISUAL_PLAN_WITH_CLIENT_ASSET if with_client_asset else VISUAL_PLAN
    (job_dir / "visual_plan.json").write_text(json.dumps(plan), encoding="utf-8")
    if with_client_asset:
        client_dir = job_dir / "assets" / "client"
        client_dir.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            [
                "ffmpeg", "-y", "-loglevel", "error",
                "-f", "lavfi", "-i", f"color=c=red:s={client_asset_dims}",
                "-frames:v", "1",
                str(client_dir / "product.png"),
            ],
            check=True,
        )


def _make_ctx(
    tmp_path: Path, *, job_dir_name: str = "job", brief: str = "cozy promo", settings: Settings | None = None
) -> JobContext:
    jobs_root = tmp_path / "jobs"
    mgr = JobManager(jobs_root=jobs_root)
    job = mgr.create("kitA", brief)
    paths = WorkspacePaths(jobs_root, job.job_id)
    logger = JobLogger(paths.log_path)
    return JobContext(
        job_id=job.job_id,
        paths=paths,
        job=job,
        logger=logger,
        settings=settings or _key_safe_settings(),
    )


def _image_transport(call_log: list[str], payload_prefix: bytes = b"\x89PNG-fixture-"):
    """Return a transport that records each call and returns unique-but-deterministic bytes."""
    counter = {"n": 0}

    def transport(method: str, model_id: str, payload: dict, api_key: str) -> dict:
        assert method == "image"
        call_log.append(model_id)
        counter["n"] += 1
        image_bytes = payload_prefix + str(counter["n"]).encode()
        return {
            "image_bytes_b64": base64.b64encode(image_bytes).decode(),
            "model_id": model_id,
        }

    return transport


def _make_stage(client: GeminiClient) -> Stage:
    return Stage(name="images", run=functools.partial(run_images, _gemini_client=client))


# ---------------------------------------------------------------------------
# Prompt construction
# ---------------------------------------------------------------------------


def test_prompt_contains_style_negative_and_hard_constraints() -> None:
    prompt = _build_prompt("cozy morning coffee scene", "cozy promo")
    assert _DEFAULT_IMAGE_STYLE in prompt
    assert _DEFAULT_NEGATIVE in prompt
    assert "9:16" in prompt
    assert "no on-image text" in prompt
    assert "no watermark" in prompt
    assert "caption safe-area" in prompt
    assert "cozy morning coffee scene" in prompt
    assert "cozy promo" in prompt


def test_prompt_omits_brief_line_when_brief_empty() -> None:
    prompt = _build_prompt("a concept", "")
    assert "Brief context" not in prompt


# ---------------------------------------------------------------------------
# Exact-path generation
# ---------------------------------------------------------------------------


def test_generated_image_saved_at_exact_asset_path(tmp_path: Path) -> None:
    ctx = _make_ctx(tmp_path)
    _write_inputs(ctx.paths.job_dir)
    call_log: list[str] = []
    client = GeminiClient(transport=_image_transport(call_log), backoff_s=0)

    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        asyncio.run(run_images(ctx, _gemini_client=client))

    v1_path = ctx.paths.job_dir / "assets" / "images" / "v1.png"
    v4_path = ctx.paths.job_dir / "assets" / "images" / "v4.png"
    assert v1_path.exists()
    assert v4_path.exists()


def test_animated_text_produces_no_image_file(tmp_path: Path) -> None:
    ctx = _make_ctx(tmp_path)
    _write_inputs(ctx.paths.job_dir)
    client = GeminiClient(transport=_image_transport([]), backoff_s=0)

    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        asyncio.run(run_images(ctx, _gemini_client=client))

    # v3 is animated_text with asset=None — nothing under assets/images/v3.*
    images_dir = ctx.paths.job_dir / "assets" / "images"
    assert not any(p.stem == "v3" for p in images_dir.iterdir())


# ---------------------------------------------------------------------------
# Caching
# ---------------------------------------------------------------------------


def test_identical_prompts_cause_one_generate_call_both_files_written(tmp_path: Path) -> None:
    ctx = _make_ctx(tmp_path)
    _write_inputs(ctx.paths.job_dir)
    call_log: list[str] = []
    client = GeminiClient(transport=_image_transport(call_log), backoff_s=0)

    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        asyncio.run(run_images(ctx, _gemini_client=client))

    # v1 and v4 share the same visual_intent ("cozy morning coffee scene") -> same prompt.
    assert len(call_log) == 1

    v1_bytes = (ctx.paths.job_dir / "assets" / "images" / "v1.png").read_bytes()
    v4_bytes = (ctx.paths.job_dir / "assets" / "images" / "v4.png").read_bytes()
    assert v1_bytes == v4_bytes

    manifest = json.loads((ctx.paths.job_dir / "images.json").read_text(encoding="utf-8"))
    assert manifest["generated"] == 1
    assert manifest["cached"] == 1
    statuses = {e["visual_id"]: e["status"] for e in manifest["images"]}
    assert statuses["v1"] == "generated"
    assert statuses["v4"] == "cached"


# ---------------------------------------------------------------------------
# Ceiling
# ---------------------------------------------------------------------------


def test_ceiling_stops_generation_and_flags_unfilled(tmp_path: Path) -> None:
    ctx = _make_ctx(tmp_path, settings=_key_safe_settings(max_images_per_job=1))
    # Distinct intents so v1 and v4 don't hit the cache and both need a real call.
    understanding = json.loads(json.dumps(UNDERSTANDING))
    understanding["segments"][3]["visual_intent"] = "a totally different concept"
    (ctx.paths.job_dir / "understanding.json").write_text(json.dumps(understanding), encoding="utf-8")
    (ctx.paths.job_dir / "visual_plan.json").write_text(json.dumps(VISUAL_PLAN), encoding="utf-8")

    call_log: list[str] = []
    client = GeminiClient(transport=_image_transport(call_log), backoff_s=0)

    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        asyncio.run(run_images(ctx, _gemini_client=client))

    assert len(call_log) == 1  # ceiling=1, only v1 generated
    assert not (ctx.paths.job_dir / "assets" / "images" / "v4.png").exists()

    manifest = json.loads((ctx.paths.job_dir / "images.json").read_text(encoding="utf-8"))
    assert manifest["skipped_ceiling"] == 1
    v4_entry = next(e for e in manifest["images"] if e["visual_id"] == "v4")
    assert v4_entry["status"] == "skipped_ceiling"


def test_cost_meter_incremented_per_generated_image(tmp_path: Path) -> None:
    ctx = _make_ctx(tmp_path)
    _write_inputs(ctx.paths.job_dir)
    client = GeminiClient(transport=_image_transport([]), backoff_s=0)

    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        asyncio.run(run_images(ctx, _gemini_client=client))

    manifest = json.loads((ctx.paths.job_dir / "images.json").read_text(encoding="utf-8"))
    # 1 real generation (v1; v4 is a cache hit) at $0.04 (Flash, D-024).
    assert manifest["cost_estimate_usd"] == pytest.approx(0.04)


# ---------------------------------------------------------------------------
# Model selection / cheap_mode
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("cheap_mode", [True, False])
def test_flash_model_always_used_regardless_of_cheap_mode(tmp_path: Path, cheap_mode: bool) -> None:
    ctx = _make_ctx(tmp_path, settings=_key_safe_settings(cheap_mode=cheap_mode))
    _write_inputs(ctx.paths.job_dir)
    call_log: list[str] = []
    client = GeminiClient(transport=_image_transport(call_log), backoff_s=0)

    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        asyncio.run(run_images(ctx, _gemini_client=client))

    assert call_log
    assert all(m == ctx.settings.gemini_image_model for m in call_log)
    assert all(m != ctx.settings.gemini_image_pro_model for m in call_log)


# ---------------------------------------------------------------------------
# Client-asset reframe
# ---------------------------------------------------------------------------


@skip_no_fftools
def test_client_asset_reframed_when_not_9x16(tmp_path: Path) -> None:
    ctx = _make_ctx(tmp_path)
    _write_inputs(ctx.paths.job_dir, with_client_asset=True, client_asset_dims="800x800")
    client = GeminiClient(transport=_image_transport([]), backoff_s=0)

    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        asyncio.run(run_images(ctx, _gemini_client=client))

    reframed = ctx.paths.job_dir / "assets" / "client" / "product_9x16.png"
    assert reframed.exists()

    manifest = json.loads((ctx.paths.job_dir / "images.json").read_text(encoding="utf-8"))
    assert manifest["client_reframed"] == 1
    v2_entry = next(e for e in manifest["images"] if e["visual_id"] == "v2")
    assert v2_entry["status"] == "reframed"
    assert v2_entry["asset"] == "assets/client/product_9x16.png"


@skip_no_fftools
def test_client_asset_unchanged_when_already_9x16(tmp_path: Path) -> None:
    ctx = _make_ctx(tmp_path)
    _write_inputs(ctx.paths.job_dir, with_client_asset=True, client_asset_dims="1080x1920")
    client = GeminiClient(transport=_image_transport([]), backoff_s=0)

    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        asyncio.run(run_images(ctx, _gemini_client=client))

    assert not (ctx.paths.job_dir / "assets" / "client" / "product_9x16.png").exists()
    manifest = json.loads((ctx.paths.job_dir / "images.json").read_text(encoding="utf-8"))
    assert manifest["client_reframed"] == 0
    v2_entry = next(e for e in manifest["images"] if e["visual_id"] == "v2")
    assert v2_entry["status"] == "unchanged"
    assert v2_entry["asset"] == "assets/client/product.png"


@skip_no_fftools
def test_no_gemini_call_for_client_asset(tmp_path: Path) -> None:
    ctx = _make_ctx(tmp_path)
    _write_inputs(ctx.paths.job_dir, with_client_asset=True, client_asset_dims="800x800")
    call_log: list[str] = []
    client = GeminiClient(transport=_image_transport(call_log), backoff_s=0)

    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        asyncio.run(run_images(ctx, _gemini_client=client))

    # 2 distinct-prompt generated_image visuals (v1 unique, v4 shares v1's prompt -> cached).
    assert len(call_log) == 1


# ---------------------------------------------------------------------------
# Errors (fail loud)
# ---------------------------------------------------------------------------


def test_missing_visual_plan_raises(tmp_path: Path) -> None:
    ctx = _make_ctx(tmp_path)
    (ctx.paths.job_dir / "understanding.json").write_text(json.dumps(UNDERSTANDING), encoding="utf-8")
    client = GeminiClient(transport=_image_transport([]), backoff_s=0)
    with pytest.raises(ImagesError, match="visual_plan"):
        asyncio.run(run_images(ctx, _gemini_client=client))


def test_missing_understanding_raises(tmp_path: Path) -> None:
    ctx = _make_ctx(tmp_path)
    (ctx.paths.job_dir / "visual_plan.json").write_text(json.dumps(VISUAL_PLAN), encoding="utf-8")
    client = GeminiClient(transport=_image_transport([]), backoff_s=0)
    with pytest.raises(ImagesError, match="understanding"):
        asyncio.run(run_images(ctx, _gemini_client=client))


# ---------------------------------------------------------------------------
# Runner integration
# ---------------------------------------------------------------------------


def test_runs_through_runner_and_writes_artifact(tmp_path: Path) -> None:
    jobs_root = tmp_path / "jobs"
    mgr = JobManager(jobs_root=jobs_root)
    job = mgr.create("kitA", "cozy promo")
    job_dir = jobs_root / job.job_id
    _write_inputs(job_dir)

    call_log: list[str] = []
    client = GeminiClient(transport=_image_transport(call_log), backoff_s=0)
    stage = _make_stage(client)

    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        asyncio.run(mgr.run_pipeline(job.job_id, [stage]))

    status = mgr.status(job.job_id)
    assert status.state == JobState.READY_FOR_AE
    assert status.progress_pct == 100.0

    artifact = job_dir / "images.json"
    assert artifact.exists()
