"""Tests for the forced-alignment stage (T-107).

No real aligner (WhisperX / torch) is required — all tests use injected fake
AlignerCallable implementations.

Arabic content is verified by codepoint, not visual appearance (BIDI display
trap — BUILD_STATE §5 / D-031).

Fixture: tests/fixtures/aligner/corrected_transcript.json
  Segment 0 (index=0): "Salam بزاف ديال promo"  — 4 words
  Segment 1 (index=1): "مزيان le design"         — 3 words
  Total: 7 words.  Audio WAV is silent 5.0 s created by _make_wav().
"""

from __future__ import annotations

import asyncio
import functools
import json
import struct
import wave
from pathlib import Path

from app.jobs.manager import JobManager, Stage
from app.pipeline.align import _derive_script, run_align

FIXTURES_DIR = Path(__file__).parent / "fixtures" / "aligner"
CORRECTED_TRANSCRIPT = FIXTURES_DIR / "corrected_transcript.json"

# Fixture has 7 words (4 in seg 0, 3 in seg 1).
_WORD_COUNT = 7
_AUDIO_DURATION_S = 5.0


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_wav(path: Path, duration_s: float = _AUDIO_DURATION_S, sample_rate: int = 16_000) -> None:
    """Write a valid silent PCM WAV file.  Used instead of ffmpeg to avoid a real
    audio encode in unit tests — the alignment stage only reads the duration header."""
    n_frames = int(duration_s * sample_rate)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(sample_rate)
        wf.writeframes(struct.pack(f"<{n_frames}h", *([0] * n_frames)))


def _setup_job(tmp_path: Path) -> tuple[JobManager, object]:
    """Create a manager + job + audio.wav + transcript_corrected.json from fixture."""
    jobs_root = tmp_path / "jobs"
    mgr = JobManager(jobs_root=jobs_root)
    job = mgr.create("kitA", "brief")
    job_dir = jobs_root / job.job_id
    _make_wav(job_dir / "audio.wav")
    (job_dir / "transcript_corrected.json").write_text(
        CORRECTED_TRANSCRIPT.read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    return mgr, job


def _make_align_stage(aligner) -> Stage:
    return Stage(name="align", run=functools.partial(run_align, _aligner=aligner))


# ---------------------------------------------------------------------------
# Fake aligners
# ---------------------------------------------------------------------------


def _valid_aligner(audio_path: Path, words: list[str]) -> list[tuple[float, float]]:
    """Deterministic: word i → [i*0.5, i*0.5+0.4].  All within 5 s, monotonic."""
    return [(i * 0.5, i * 0.5 + 0.4) for i in range(len(words))]


def _aligner_wrong_count(audio_path: Path, words: list[str]) -> list[tuple[float, float]]:
    """Always returns exactly 1 timing, regardless of word count."""
    return [(0.0, 0.5)]


def _aligner_overlap(audio_path: Path, words: list[str]) -> list[tuple[float, float]]:
    """Word 1 starts before word 0 ends — monotonicity violation."""
    result = _valid_aligner(audio_path, words)
    if len(result) >= 2:
        # word 0 ends at 0.4; word 1 starts at 0.2 → overlap
        result[1] = (0.2, 0.7)
    return result


def _aligner_end_before_start(audio_path: Path, words: list[str]) -> list[tuple[float, float]]:
    """First word has end < start."""
    result = _valid_aligner(audio_path, words)
    if result:
        result[0] = (0.5, 0.1)
    return result


def _aligner_out_of_bounds(audio_path: Path, words: list[str]) -> list[tuple[float, float]]:
    """Last word ends far beyond audio duration."""
    result = _valid_aligner(audio_path, words)
    if result:
        result[-1] = (result[-1][0], 999.0)
    return result


# ---------------------------------------------------------------------------
# Unit tests: _derive_script
# ---------------------------------------------------------------------------


def test_derive_script_latin_ascii() -> None:
    assert _derive_script("Salam") == "latin"
    assert _derive_script("promo") == "latin"
    assert _derive_script("300") == "latin"
    assert _derive_script("le") == "latin"
    assert _derive_script("design") == "latin"


def test_derive_script_arabic_block() -> None:
    # بزاف: first char ب = U+0628 (in U+0600–U+06FF)
    assert ord("بزاف"[0]) == 0x0628
    assert _derive_script("بزاف") == "arabic"

    # ديال: first char د = U+062F
    assert ord("ديال"[0]) == 0x062F
    assert _derive_script("ديال") == "arabic"

    # مزيان: first char م = U+0645
    assert ord("مزيان"[0]) == 0x0645
    assert _derive_script("مزيان") == "arabic"


def test_derive_script_mixed_word_is_arabic() -> None:
    """A word containing at least one Arabic codepoint → arabic, even if mixed."""
    assert _derive_script("prix٢٣") == "arabic"  # ٢٣ are Arabic-Indic digits U+0662/0663


def test_derive_script_punctuation_only_is_latin() -> None:
    assert _derive_script("!?.,") == "latin"


# ---------------------------------------------------------------------------
# Happy-path shape and placement
# ---------------------------------------------------------------------------


def test_happy_path_produces_words_json(tmp_path: Path) -> None:
    mgr, job = _setup_job(tmp_path)
    asyncio.run(mgr.run_pipeline(job.job_id, [_make_align_stage(_valid_aligner)]))

    assert mgr.status(job.job_id).state.value == "ready_for_ae"
    words_file = tmp_path / "jobs" / job.job_id / "words.json"
    assert words_file.exists(), "words.json must be created at the job root"


def test_words_json_at_job_root_not_under_assets(tmp_path: Path) -> None:
    mgr, job = _setup_job(tmp_path)
    asyncio.run(mgr.run_pipeline(job.job_id, [_make_align_stage(_valid_aligner)]))

    job_dir = tmp_path / "jobs" / job.job_id
    assert (job_dir / "words.json").exists()
    assert not (job_dir / "assets" / "words.json").exists()


def test_words_json_is_a_flat_list(tmp_path: Path) -> None:
    mgr, job = _setup_job(tmp_path)
    asyncio.run(mgr.run_pipeline(job.job_id, [_make_align_stage(_valid_aligner)]))

    words = json.loads(
        (tmp_path / "jobs" / job.job_id / "words.json").read_text(encoding="utf-8")
    )
    assert isinstance(words, list), "words.json top level must be a JSON array"


def test_words_json_count_matches_tokens(tmp_path: Path) -> None:
    mgr, job = _setup_job(tmp_path)
    asyncio.run(mgr.run_pipeline(job.job_id, [_make_align_stage(_valid_aligner)]))

    words = json.loads(
        (tmp_path / "jobs" / job.job_id / "words.json").read_text(encoding="utf-8")
    )
    # Fixture: 4 words in seg0 + 3 words in seg1 = 7
    assert len(words) == _WORD_COUNT


def test_words_json_entry_shape(tmp_path: Path) -> None:
    """Each entry must have {word, script, start, end, segment_index}."""
    mgr, job = _setup_job(tmp_path)
    asyncio.run(mgr.run_pipeline(job.job_id, [_make_align_stage(_valid_aligner)]))

    words = json.loads(
        (tmp_path / "jobs" / job.job_id / "words.json").read_text(encoding="utf-8")
    )
    for entry in words:
        assert "word" in entry
        assert "script" in entry
        assert "start" in entry
        assert "end" in entry
        assert "segment_index" in entry
        assert entry["script"] in ("arabic", "latin")
        assert isinstance(entry["start"], float | int)
        assert isinstance(entry["end"], float | int)
        assert isinstance(entry["segment_index"], int)


def test_words_in_reading_order(tmp_path: Path) -> None:
    """Words appear in reading order and timings are monotonically increasing."""
    mgr, job = _setup_job(tmp_path)
    asyncio.run(mgr.run_pipeline(job.job_id, [_make_align_stage(_valid_aligner)]))

    words = json.loads(
        (tmp_path / "jobs" / job.job_id / "words.json").read_text(encoding="utf-8")
    )
    starts = [w["start"] for w in words]
    assert starts == sorted(starts), "word start times must be non-decreasing"


def test_segment_index_attribution(tmp_path: Path) -> None:
    """Words from segment 0 get segment_index=0; words from segment 1 get 1."""
    mgr, job = _setup_job(tmp_path)
    asyncio.run(mgr.run_pipeline(job.job_id, [_make_align_stage(_valid_aligner)]))

    words = json.loads(
        (tmp_path / "jobs" / job.job_id / "words.json").read_text(encoding="utf-8")
    )
    # First 4 words from seg 0, last 3 from seg 1
    assert all(w["segment_index"] == 0 for w in words[:4])
    assert all(w["segment_index"] == 1 for w in words[4:])


# ---------------------------------------------------------------------------
# Bidi canonical test (codepoint-verified)
# ---------------------------------------------------------------------------


def test_bidi_canonical_scripts_by_codepoint(tmp_path: Path) -> None:
    """The canonical line "Salam بزاف ديال promo" → correct scripts from codepoints.

    Verified by codepoint, NOT visual appearance (BIDI display trap — D-031).
    Segment 0 of the fixture IS this canonical line.
    """
    mgr, job = _setup_job(tmp_path)
    asyncio.run(mgr.run_pipeline(job.job_id, [_make_align_stage(_valid_aligner)]))

    words = json.loads(
        (tmp_path / "jobs" / job.job_id / "words.json").read_text(encoding="utf-8")
    )
    # Segment 0 words: Salam, بزاف, ديال, promo
    w0, w1, w2, w3 = words[0], words[1], words[2], words[3]

    assert w0["word"] == "Salam" and w0["script"] == "latin"

    # بزاف: ب=U+0628 (Arabic) → arabic
    assert ord(w1["word"][0]) == 0x0628, f"Expected U+0628 (ب), got U+{ord(w1['word'][0]):04X}"
    assert w1["script"] == "arabic"

    # ديال: د=U+062F (Arabic) → arabic
    assert ord(w2["word"][0]) == 0x062F, f"Expected U+062F (د), got U+{ord(w2['word'][0]):04X}"
    assert w2["script"] == "arabic"

    assert w3["word"] == "promo" and w3["script"] == "latin"


def test_arabic_surface_form_preserved(tmp_path: Path) -> None:
    """Arabic word surface forms must be preserved in logical order in words.json.

    BIDI trap: verify by codepoint, not visual output.  ensure_ascii=False
    means Arabic is stored as raw UTF-8 chars (not \\uXXXX escapes).
    """
    mgr, job = _setup_job(tmp_path)
    asyncio.run(mgr.run_pipeline(job.job_id, [_make_align_stage(_valid_aligner)]))

    raw_text = (tmp_path / "jobs" / job.job_id / "words.json").read_text(encoding="utf-8")

    # ensure_ascii=False: Arabic appears as-is, not \\uXXXX
    assert "\\u0628" not in raw_text, "Arabic must be raw UTF-8, not \\u-escaped"

    # Verify بزاف stored in logical order: ب(0x0628) ز(0x0632) ا(0x0627) ف(0x0641)
    words = json.loads(raw_text)
    bzaf = words[1]["word"]  # second word of seg 0
    assert ord(bzaf[0]) == 0x0628
    assert ord(bzaf[1]) == 0x0632
    assert ord(bzaf[2]) == 0x0627
    assert ord(bzaf[3]) == 0x0641


def test_segment_1_arabic_word_script(tmp_path: Path) -> None:
    """مزيان (first word of segment 1) is arabic by codepoint derivation."""
    mgr, job = _setup_job(tmp_path)
    asyncio.run(mgr.run_pipeline(job.job_id, [_make_align_stage(_valid_aligner)]))

    words = json.loads(
        (tmp_path / "jobs" / job.job_id / "words.json").read_text(encoding="utf-8")
    )
    mzyan = words[4]  # first word of seg 1
    assert ord(mzyan["word"][0]) == 0x0645  # م
    assert mzyan["script"] == "arabic"
    assert mzyan["segment_index"] == 1


# ---------------------------------------------------------------------------
# Missing inputs
# ---------------------------------------------------------------------------


def test_missing_audio_wav_produces_error(tmp_path: Path) -> None:
    jobs_root = tmp_path / "jobs"
    mgr = JobManager(jobs_root=jobs_root)
    job = mgr.create("kitA", "brief")
    # Write corrected transcript but NO audio.wav
    (jobs_root / job.job_id / "transcript_corrected.json").write_text(
        CORRECTED_TRANSCRIPT.read_text(encoding="utf-8"),
        encoding="utf-8",
    )

    asyncio.run(mgr.run_pipeline(job.job_id, [_make_align_stage(_valid_aligner)]))

    status = mgr.status(job.job_id)
    assert status.state.value == "error"
    assert "audio.wav" in status.message
    assert "not found" in status.message.lower()


def test_missing_corrected_transcript_produces_error(tmp_path: Path) -> None:
    jobs_root = tmp_path / "jobs"
    mgr = JobManager(jobs_root=jobs_root)
    job = mgr.create("kitA", "brief")
    # Write audio.wav but NO transcript_corrected.json
    _make_wav(jobs_root / job.job_id / "audio.wav")

    asyncio.run(mgr.run_pipeline(job.job_id, [_make_align_stage(_valid_aligner)]))

    status = mgr.status(job.job_id)
    assert status.state.value == "error"
    assert "transcript_corrected.json" in status.message
    assert "not found" in status.message.lower()


def test_missing_audio_does_not_write_words_json(tmp_path: Path) -> None:
    jobs_root = tmp_path / "jobs"
    mgr = JobManager(jobs_root=jobs_root)
    job = mgr.create("kitA", "brief")

    asyncio.run(mgr.run_pipeline(job.job_id, [_make_align_stage(_valid_aligner)]))

    assert not (jobs_root / job.job_id / "words.json").exists()


# ---------------------------------------------------------------------------
# Validation failures
# ---------------------------------------------------------------------------


def test_count_mismatch_fails_loud(tmp_path: Path) -> None:
    """Aligner returns 1 timing for 7 words → clear error, runner state=error."""
    mgr, job = _setup_job(tmp_path)
    asyncio.run(mgr.run_pipeline(job.job_id, [_make_align_stage(_aligner_wrong_count)]))

    status = mgr.status(job.job_id)
    assert status.state.value == "error"
    assert "mismatch" in status.message.lower() or "count" in status.message.lower()


def test_count_mismatch_does_not_write_words_json(tmp_path: Path) -> None:
    mgr, job = _setup_job(tmp_path)
    asyncio.run(mgr.run_pipeline(job.job_id, [_make_align_stage(_aligner_wrong_count)]))
    assert not (tmp_path / "jobs" / job.job_id / "words.json").exists()


def test_overlap_violation_fails_loud(tmp_path: Path) -> None:
    """Overlapping word timings → clear error."""
    mgr, job = _setup_job(tmp_path)
    asyncio.run(mgr.run_pipeline(job.job_id, [_make_align_stage(_aligner_overlap)]))

    status = mgr.status(job.job_id)
    assert status.state.value == "error"
    msg = status.message.lower()
    assert "overlap" in msg or "monoton" in msg


def test_end_before_start_fails_loud(tmp_path: Path) -> None:
    """end < start for a word → clear error."""
    mgr, job = _setup_job(tmp_path)
    asyncio.run(mgr.run_pipeline(job.job_id, [_make_align_stage(_aligner_end_before_start)]))

    status = mgr.status(job.job_id)
    assert status.state.value == "error"
    msg = status.message.lower()
    assert "not after start" in msg or "duration" in msg or "end" in msg


def test_out_of_bounds_fails_loud(tmp_path: Path) -> None:
    """Timing beyond audio duration → clear error."""
    mgr, job = _setup_job(tmp_path)
    asyncio.run(mgr.run_pipeline(job.job_id, [_make_align_stage(_aligner_out_of_bounds)]))

    status = mgr.status(job.job_id)
    assert status.state.value == "error"
    msg = status.message.lower()
    assert "duration" in msg or "exceeds" in msg


# ---------------------------------------------------------------------------
# Through-runner
# ---------------------------------------------------------------------------


def test_through_runner_success_state(tmp_path: Path) -> None:
    """Through the T-101 runner: success → ready_for_ae, progress=100."""
    mgr, job = _setup_job(tmp_path)
    asyncio.run(mgr.run_pipeline(job.job_id, [_make_align_stage(_valid_aligner)]))

    assert mgr.status(job.job_id).state.value == "ready_for_ae"
    assert mgr.status(job.job_id).progress_pct == 100.0


def test_through_runner_missing_audio_error_state(tmp_path: Path) -> None:
    """Through the T-101 runner: missing audio.wav → state=error with message."""
    jobs_root = tmp_path / "jobs"
    mgr = JobManager(jobs_root=jobs_root)
    job = mgr.create("kitA", "brief")
    (jobs_root / job.job_id / "transcript_corrected.json").write_text(
        CORRECTED_TRANSCRIPT.read_text(encoding="utf-8"),
        encoding="utf-8",
    )

    asyncio.run(mgr.run_pipeline(job.job_id, [_make_align_stage(_valid_aligner)]))

    status = mgr.status(job.job_id)
    assert status.state.value == "error"
    assert status.message
