"""Tests for the understanding & segmentation pipeline stage (T-108).

All tests use the GeminiClient injection seam — no real API calls are made.
Arabic content in fixtures is verified by codepoint, not visual appearance,
per the BIDI display trap (BUILD_STATE §5 / PROGRESS.md T-107).
"""

from __future__ import annotations

import asyncio
import functools
import json
from pathlib import Path

import pytest

from app.clients.gemini import GeminiClient
from app.config import Settings
from app.jobs.joblog import JobLogger
from app.jobs.manager import JobContext, JobManager, Stage
from app.jobs.paths import WorkspacePaths
from app.models.understanding import Understanding
from app.pipeline.understand import _PROMPT_PATH, UnderstandError, run_understand

FIXTURES_GEMINI = Path(__file__).parent / "fixtures" / "gemini"
FIXTURES_UNDERSTAND = Path(__file__).parent / "fixtures" / "understand"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _fixture_transport(name: str):
    """Return a transport callable backed by a named Gemini fixture."""
    data = json.loads((FIXTURES_GEMINI / f"{name}.json").read_text(encoding="utf-8"))

    def transport(method: str, model_id: str, payload: dict, api_key: str) -> dict:
        return data

    return transport


def _text_transport(raw_text: str):
    """Return a transport callable that emits a fixed raw_text string."""

    def transport(method: str, model_id: str, payload: dict, api_key: str) -> dict:
        return {"text": raw_text, "model_id": "gemini-test"}

    return transport


def _key_safe_settings() -> Settings:
    return Settings(
        _env_file="/nonexistent/.env",
        gemini_api_key="test-key-for-understand",  # type: ignore[arg-type]
    )


def _write_inputs(job_dir: Path) -> None:
    """Write the canonical corrected_transcript.json and words.json fixtures."""
    (job_dir / "transcript_corrected.json").write_bytes(
        (FIXTURES_UNDERSTAND / "corrected_transcript.json").read_bytes()
    )
    (job_dir / "words.json").write_bytes(
        (FIXTURES_UNDERSTAND / "words.json").read_bytes()
    )


def _make_stage(client: GeminiClient) -> Stage:
    return Stage(
        name="understand",
        run=functools.partial(run_understand, _gemini_client=client),
    )


def _make_ctx(mgr: JobManager, job_id: str) -> JobContext:
    """Build a real JobContext for direct run_understand() calls."""
    job = mgr.get_job(job_id)
    paths = WorkspacePaths(mgr._jobs_root, job_id)
    logger = JobLogger(paths.job_dir / "log.txt")
    return JobContext(
        job_id=job_id,
        paths=paths,
        job=job,
        logger=logger,
        settings=_key_safe_settings(),
    )


# ---------------------------------------------------------------------------
# Prompt file tests  (no network / no monkeypatch needed)
# ---------------------------------------------------------------------------


def test_understand_prompt_file_exists() -> None:
    """app/prompts/understand.md must exist and be readable."""
    assert _PROMPT_PATH.exists(), f"Prompt file not found: {_PROMPT_PATH}"
    assert _PROMPT_PATH.is_file()


def test_understand_prompt_contains_emphasis_rule() -> None:
    """Prompt must encode the §11.3 emphasis rule: nouns, numbers, brands, verbs."""
    text = _PROMPT_PATH.read_text(encoding="utf-8").lower()
    assert "noun" in text, "Prompt must mention nouns as emphasis candidates"
    assert "number" in text, "Prompt must mention numbers as emphasis candidates"
    assert "brand" in text, "Prompt must mention brand names as emphasis candidates"
    assert "product" in text, "Prompt must mention product names as emphasis candidates"
    assert "verb" in text, "Prompt must mention verbs as emphasis candidates"


# ---------------------------------------------------------------------------
# Happy-path tests
# ---------------------------------------------------------------------------


def test_happy_path_produces_understanding_json(tmp_path: Path) -> None:
    """Stage writes understanding.json at the job root on success."""
    mgr = JobManager(jobs_root=tmp_path / "jobs")
    job = mgr.create("kitA", "cold-brew promo 300 dirham")
    _write_inputs(mgr._jobs_root / job.job_id)

    client = GeminiClient(
        transport=_fixture_transport("understand_t108_response"), backoff_s=0
    )
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        asyncio.run(mgr.run_pipeline(job.job_id, [_make_stage(client)]))

    out = mgr._jobs_root / job.job_id / "understanding.json"
    assert out.exists(), "understanding.json must be written at the job root"


def test_understanding_json_schema_valid(tmp_path: Path) -> None:
    """understanding.json must validate against the Understanding Pydantic model."""
    mgr = JobManager(jobs_root=tmp_path / "jobs")
    job = mgr.create("kitA", "brief")
    _write_inputs(mgr._jobs_root / job.job_id)

    client = GeminiClient(
        transport=_fixture_transport("understand_t108_response"), backoff_s=0
    )
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        asyncio.run(mgr.run_pipeline(job.job_id, [_make_stage(client)]))

    data = json.loads(
        (mgr._jobs_root / job.job_id / "understanding.json").read_text(encoding="utf-8")
    )
    u = Understanding.model_validate(data)
    assert isinstance(u.summary, str) and u.summary
    assert isinstance(u.segments, list) and len(u.segments) > 0


def test_summary_present_and_non_empty(tmp_path: Path) -> None:
    """understanding.json must contain a non-empty summary string."""
    mgr = JobManager(jobs_root=tmp_path / "jobs")
    job = mgr.create("kitA", "brief")
    _write_inputs(mgr._jobs_root / job.job_id)

    client = GeminiClient(
        transport=_fixture_transport("understand_t108_response"), backoff_s=0
    )
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        asyncio.run(mgr.run_pipeline(job.job_id, [_make_stage(client)]))

    data = json.loads(
        (mgr._jobs_root / job.job_id / "understanding.json").read_text(encoding="utf-8")
    )
    assert data["summary"] and isinstance(data["summary"], str)


def test_segment_shape(tmp_path: Path) -> None:
    """Each segment must have index, text, start, end, visual_intent, emphasis_word_indices."""
    mgr = JobManager(jobs_root=tmp_path / "jobs")
    job = mgr.create("kitA", "brief")
    _write_inputs(mgr._jobs_root / job.job_id)

    client = GeminiClient(
        transport=_fixture_transport("understand_t108_response"), backoff_s=0
    )
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        asyncio.run(mgr.run_pipeline(job.job_id, [_make_stage(client)]))

    data = json.loads(
        (mgr._jobs_root / job.job_id / "understanding.json").read_text(encoding="utf-8")
    )
    for seg in data["segments"]:
        assert "index" in seg
        assert "text" in seg
        assert "start" in seg
        assert "end" in seg
        assert "visual_intent" in seg
        assert "emphasis_word_indices" in seg
        assert isinstance(seg["emphasis_word_indices"], list)


# ---------------------------------------------------------------------------
# visual_intent tests
# ---------------------------------------------------------------------------


def test_visual_intent_non_empty(tmp_path: Path) -> None:
    """All segments must have a non-empty visual_intent."""
    mgr = JobManager(jobs_root=tmp_path / "jobs")
    job = mgr.create("kitA", "brief")
    _write_inputs(mgr._jobs_root / job.job_id)

    client = GeminiClient(
        transport=_fixture_transport("understand_t108_response"), backoff_s=0
    )
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        asyncio.run(mgr.run_pipeline(job.job_id, [_make_stage(client)]))

    data = json.loads(
        (mgr._jobs_root / job.job_id / "understanding.json").read_text(encoding="utf-8")
    )
    for seg in data["segments"]:
        assert seg["visual_intent"], f"Segment {seg['index']} has empty visual_intent"
        assert seg["visual_intent"].strip()


def test_speaker_only_visual_intent_accepted(tmp_path: Path) -> None:
    """'speaker only' is a valid visual_intent — the fixture has one such segment."""
    mgr = JobManager(jobs_root=tmp_path / "jobs")
    job = mgr.create("kitA", "brief")
    _write_inputs(mgr._jobs_root / job.job_id)

    client = GeminiClient(
        transport=_fixture_transport("understand_t108_response"), backoff_s=0
    )
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        asyncio.run(mgr.run_pipeline(job.job_id, [_make_stage(client)]))

    data = json.loads(
        (mgr._jobs_root / job.job_id / "understanding.json").read_text(encoding="utf-8")
    )
    intents = {seg["visual_intent"] for seg in data["segments"]}
    assert "speaker only" in intents, (
        f"Fixture must exercise the 'speaker only' case; found: {intents}"
    )


def test_empty_visual_intent_rejected(tmp_path: Path) -> None:
    """Stage must raise UnderstandError when a segment has an empty visual_intent."""
    mgr = JobManager(jobs_root=tmp_path / "jobs")
    job = mgr.create("kitA", "brief")
    _write_inputs(mgr._jobs_root / job.job_id)

    bad_response = json.dumps({
        "summary": "Test summary",
        "segments": [
            {
                "index": 0,
                "text": "Salam",
                "start": 0.0,
                "end": 0.4,
                "visual_intent": "",
                "emphasis_word_indices": [0],
            }
        ],
    })
    client = GeminiClient(transport=_text_transport(bad_response), backoff_s=0)

    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        ctx = _make_ctx(mgr, job.job_id)
        with pytest.raises(UnderstandError, match="empty visual_intent"):
            asyncio.run(run_understand(ctx, _gemini_client=client))


# ---------------------------------------------------------------------------
# Emphasis index validation
# ---------------------------------------------------------------------------


def test_emphasis_indices_in_range(tmp_path: Path) -> None:
    """All emphasis_word_indices must be in range [0, 6] for our 7-word fixture."""
    mgr = JobManager(jobs_root=tmp_path / "jobs")
    job = mgr.create("kitA", "brief")
    _write_inputs(mgr._jobs_root / job.job_id)

    client = GeminiClient(
        transport=_fixture_transport("understand_t108_response"), backoff_s=0
    )
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        asyncio.run(mgr.run_pipeline(job.job_id, [_make_stage(client)]))

    data = json.loads(
        (mgr._jobs_root / job.job_id / "understanding.json").read_text(encoding="utf-8")
    )
    words = json.loads((FIXTURES_UNDERSTAND / "words.json").read_text(encoding="utf-8"))
    word_count = len(words)
    for seg in data["segments"]:
        for idx in seg["emphasis_word_indices"]:
            assert 0 <= idx < word_count, (
                f"Index {idx} out of range [0, {word_count - 1}] in segment {seg['index']}"
            )


def test_emphasis_out_of_range_fails_loud(tmp_path: Path) -> None:
    """Out-of-range emphasis index must raise UnderstandError (fail loud, spec §20)."""
    mgr = JobManager(jobs_root=tmp_path / "jobs")
    job = mgr.create("kitA", "brief")
    _write_inputs(mgr._jobs_root / job.job_id)

    # words.json has 7 entries (0–6); index 99 is out of range
    bad_response = json.dumps({
        "summary": "Test summary",
        "segments": [
            {
                "index": 0,
                "text": "Salam",
                "start": 0.0,
                "end": 0.4,
                "visual_intent": "show product",
                "emphasis_word_indices": [99],
            }
        ],
    })
    client = GeminiClient(transport=_text_transport(bad_response), backoff_s=0)

    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        ctx = _make_ctx(mgr, job.job_id)
        with pytest.raises(UnderstandError, match="out of range"):
            asyncio.run(run_understand(ctx, _gemini_client=client))


# ---------------------------------------------------------------------------
# Missing-input tests
# ---------------------------------------------------------------------------


def test_missing_corrected_transcript_fails_loud(tmp_path: Path) -> None:
    """Missing transcript_corrected.json → runner sets job state to error."""
    mgr = JobManager(jobs_root=tmp_path / "jobs")
    job = mgr.create("kitA", "brief")
    # Write only words.json, not the transcript
    (mgr._jobs_root / job.job_id / "words.json").write_bytes(
        (FIXTURES_UNDERSTAND / "words.json").read_bytes()
    )

    client = GeminiClient(
        transport=_fixture_transport("understand_t108_response"), backoff_s=0
    )
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        asyncio.run(mgr.run_pipeline(job.job_id, [_make_stage(client)]))

    assert mgr.status(job.job_id).state.value == "error"


def test_missing_words_json_fails_loud(tmp_path: Path) -> None:
    """Missing words.json → runner sets job state to error."""
    mgr = JobManager(jobs_root=tmp_path / "jobs")
    job = mgr.create("kitA", "brief")
    # Write only transcript, not words.json
    (mgr._jobs_root / job.job_id / "transcript_corrected.json").write_bytes(
        (FIXTURES_UNDERSTAND / "corrected_transcript.json").read_bytes()
    )

    client = GeminiClient(
        transport=_fixture_transport("understand_t108_response"), backoff_s=0
    )
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        asyncio.run(mgr.run_pipeline(job.job_id, [_make_stage(client)]))

    assert mgr.status(job.job_id).state.value == "error"


# ---------------------------------------------------------------------------
# Invalid model output tests
# ---------------------------------------------------------------------------


def test_invalid_json_response_fails_loud(tmp_path: Path) -> None:
    """Non-JSON Gemini output → UnderstandError mentioning 'invalid JSON'."""
    mgr = JobManager(jobs_root=tmp_path / "jobs")
    job = mgr.create("kitA", "brief")
    _write_inputs(mgr._jobs_root / job.job_id)

    client = GeminiClient(transport=_text_transport("not valid json!!!"), backoff_s=0)

    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        ctx = _make_ctx(mgr, job.job_id)
        with pytest.raises(UnderstandError, match="invalid JSON"):
            asyncio.run(run_understand(ctx, _gemini_client=client))


def test_invalid_schema_response_fails_loud(tmp_path: Path) -> None:
    """Valid JSON but wrong schema → UnderstandError mentioning 'schema validation'."""
    mgr = JobManager(jobs_root=tmp_path / "jobs")
    job = mgr.create("kitA", "brief")
    _write_inputs(mgr._jobs_root / job.job_id)

    # 'summary' field is required but missing
    bad_response = json.dumps({"segments": []})
    client = GeminiClient(transport=_text_transport(bad_response), backoff_s=0)

    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        ctx = _make_ctx(mgr, job.job_id)
        with pytest.raises(UnderstandError, match="schema validation"):
            asyncio.run(run_understand(ctx, _gemini_client=client))


# ---------------------------------------------------------------------------
# Through-runner tests
# ---------------------------------------------------------------------------


def test_through_runner_success(tmp_path: Path) -> None:
    """Stage plugs into the T-101 runner; success → state=ready_for_ae, progress=100."""
    mgr = JobManager(jobs_root=tmp_path / "jobs")
    job = mgr.create("kitA", "cold-brew promo")
    _write_inputs(mgr._jobs_root / job.job_id)

    client = GeminiClient(
        transport=_fixture_transport("understand_t108_response"), backoff_s=0
    )
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        asyncio.run(mgr.run_pipeline(job.job_id, [_make_stage(client)]))

    status = mgr.status(job.job_id)
    assert status.state.value == "ready_for_ae"
    assert status.progress_pct == 100


def test_through_runner_error_on_missing_inputs(tmp_path: Path) -> None:
    """Runner sets job state to error when both inputs are absent."""
    mgr = JobManager(jobs_root=tmp_path / "jobs")
    job = mgr.create("kitA", "brief")
    # Write neither input

    client = GeminiClient(
        transport=_fixture_transport("understand_t108_response"), backoff_s=0
    )
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        asyncio.run(mgr.run_pipeline(job.job_id, [_make_stage(client)]))

    assert mgr.status(job.job_id).state.value == "error"


# ---------------------------------------------------------------------------
# BIDI / Arabic codepoint tests
# ---------------------------------------------------------------------------


def test_arabic_codepoints_preserved_in_segments(tmp_path: Path) -> None:
    """Segment text containing Arabic is stored in logical (codepoint) order."""
    mgr = JobManager(jobs_root=tmp_path / "jobs")
    job = mgr.create("kitA", "brief")
    _write_inputs(mgr._jobs_root / job.job_id)

    client = GeminiClient(
        transport=_fixture_transport("understand_t108_response"), backoff_s=0
    )
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        asyncio.run(mgr.run_pipeline(job.job_id, [_make_stage(client)]))

    data = json.loads(
        (mgr._jobs_root / job.job_id / "understanding.json").read_text(encoding="utf-8")
    )
    # Segment 1 text: "مزيان le design" — first char must be م (U+0645)
    seg1_text = data["segments"][1]["text"]
    assert ord(seg1_text[0]) == 0x0645, (
        f"First char of seg1 text must be م (U+0645), got U+{ord(seg1_text[0]):04X}"
    )


def test_arabic_codepoints_preserved_in_summary(tmp_path: Path) -> None:
    """Summary containing Arabic is stored in logical codepoint order."""
    mgr = JobManager(jobs_root=tmp_path / "jobs")
    job = mgr.create("kitA", "brief")
    _write_inputs(mgr._jobs_root / job.job_id)

    client = GeminiClient(
        transport=_fixture_transport("understand_t108_response"), backoff_s=0
    )
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        asyncio.run(mgr.run_pipeline(job.job_id, [_make_stage(client)]))

    data = json.loads(
        (mgr._jobs_root / job.job_id / "understanding.json").read_text(encoding="utf-8")
    )
    # Fixture summary starts with المتحدث — first char ا (alef) = U+0627
    summary = data["summary"]
    assert any(ord(ch) == 0x0627 for ch in summary), (
        "Arabic alef (U+0627) must appear in summary in logical order"
    )


def test_ensure_ascii_false_in_output(tmp_path: Path) -> None:
    """understanding.json must not escape Arabic as \\uXXXX sequences."""
    mgr = JobManager(jobs_root=tmp_path / "jobs")
    job = mgr.create("kitA", "brief")
    _write_inputs(mgr._jobs_root / job.job_id)

    client = GeminiClient(
        transport=_fixture_transport("understand_t108_response"), backoff_s=0
    )
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.clients.gemini.get_settings", lambda: _key_safe_settings())
        asyncio.run(mgr.run_pipeline(job.job_id, [_make_stage(client)]))

    raw = (mgr._jobs_root / job.job_id / "understanding.json").read_text(encoding="utf-8")
    assert "\\u0645" not in raw, "م must not be escaped; ensure_ascii=False required"
