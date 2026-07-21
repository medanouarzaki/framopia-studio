"""Forced-alignment stage — spec Stage 5 / §6.2.

Reads job_dir/audio.wav (from T-103) and job_dir/transcript_corrected.json
(from T-106), aligns the corrected words to the audio to get per-word timings,
and writes job_dir/words.json (flat list, job root, consistent with D-021).

Key architectural rule (§6.2 — do not violate):
  ACCURACY of words comes from Gemini + the human correction gate.
  This stage provides TIMING ONLY.  Alignment quality does not depend on ASR
  having guessed words right; the corrected transcript is ground truth.

Per-word script derivation (D-031):
  Script is derived from the word's OWN codepoints, NOT from any segment-level
  hint.  A word containing any Arabic-block codepoint → "arabic"; otherwise
  → "latin".  This is deliberate: the T-105 segment `script` hint is a
  convenience only and can be wrong for individual words in a code-switched
  segment (e.g. a segment labelled "arabic" that contains the Latin word
  "promo").

BIDI display trap (BUILD_STATE §5):
  Arabic words are stored in LOGICAL (codepoint) order.  words.json is written
  with ensure_ascii=False.  Never "fix" reversed-looking Arabic in tests or code.

## Injection seam for tests

run_align accepts an optional _aligner keyword argument (AlignerCallable | None).
Leave it None in production (WhisperX via make_whisperx_aligner() is used).
In tests, inject a deterministic fake:

    import functools
    from app.pipeline.align import run_align
    stage = Stage(name="align", run=functools.partial(run_align, _aligner=my_fake))
"""

from __future__ import annotations

import json
import time
import wave
from pathlib import Path

from app.clients.aligner import AlignerCallable, AlignerError, make_whisperx_aligner
from app.jobs.manager import JobContext
from app.models.transcript import Transcript

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Arabic Unicode blocks (from task spec §6.2 / D-031).
# A word containing any codepoint in these ranges → "arabic".
_ARABIC_RANGES: list[tuple[int, int]] = [
    (0x0600, 0x06FF),  # Arabic
    (0x0750, 0x077F),  # Arabic Supplement
    (0x08A0, 0x08FF),  # Arabic Extended-A
    (0xFB50, 0xFDFF),  # Arabic Presentation Forms-A
    (0xFE70, 0xFEFF),  # Arabic Presentation Forms-B
]

# Tolerance for floating-point timing comparisons (0.1 ms).
# Applied to the monotonicity check only; end > start is checked strictly.
_MONO_EPSILON: float = 1e-4


# ---------------------------------------------------------------------------
# Stage-level error
# ---------------------------------------------------------------------------


class AlignError(RuntimeError):
    """Raised when the forced-alignment stage fails.

    The message is human-readable and safe to surface to the operator.
    """


# ---------------------------------------------------------------------------
# Per-word script derivation
# ---------------------------------------------------------------------------


def _derive_script(word: str) -> str:
    """Return "arabic" if *word* contains any Arabic-block codepoint; "latin" otherwise.

    Derived from the word's OWN codepoints — never inherited from a segment hint.
    Latin words, digits, punctuation-only tokens → "latin" (D-031).
    """
    for ch in word:
        cp = ord(ch)
        for lo, hi in _ARABIC_RANGES:
            if lo <= cp <= hi:
                return "arabic"
    return "latin"


# ---------------------------------------------------------------------------
# Audio duration helper
# ---------------------------------------------------------------------------


def _read_audio_duration(audio_path: Path) -> float:
    """Return duration in seconds by reading the PCM WAV header."""
    try:
        with wave.open(str(audio_path), "rb") as wf:
            return wf.getnframes() / wf.getframerate()
    except Exception as exc:
        raise AlignError(
            f"Could not read audio duration from {audio_path}: {exc}"
        ) from exc


# ---------------------------------------------------------------------------
# Stage entry point
# ---------------------------------------------------------------------------


async def run_align(
    ctx: JobContext,
    *,
    _aligner: AlignerCallable | None = None,
) -> None:
    """Forced-alignment stage entry point.

    Called by the T-101 stage runner via Stage(name="align", run=run_align).
    Raises AlignError on any failure so the runner sets job state to ERROR.

    Args:
        ctx:      Job context from the runner.
        _aligner: Injectable AlignerCallable for tests.  Leave None in
                  production (WhisperX is used via make_whisperx_aligner()).
    """
    t0 = time.monotonic()

    # ------------------------------------------------------------------
    # 1. Verify both inputs exist
    # ------------------------------------------------------------------
    audio = ctx.paths.job_dir / "audio.wav"
    corrected = ctx.paths.job_dir / "transcript_corrected.json"

    if not audio.exists() or not audio.is_file():
        raise AlignError(
            f"audio.wav not found at {audio}. "
            "Run the audio-extraction stage (T-103) before alignment."
        )
    if not corrected.exists() or not corrected.is_file():
        raise AlignError(
            f"transcript_corrected.json not found at {corrected}. "
            "Run the correction gate (T-106) before alignment."
        )

    # ------------------------------------------------------------------
    # 2. Read and validate the corrected transcript (operator's ground truth)
    # ------------------------------------------------------------------
    try:
        data = json.loads(corrected.read_text(encoding="utf-8"))
        transcript = Transcript.model_validate(data)
    except Exception as exc:
        raise AlignError(
            f"Could not read or validate transcript_corrected.json: {exc}"
        ) from exc

    # ------------------------------------------------------------------
    # 3. Tokenise each segment's text into (word, segment_index) pairs.
    #    Surface form is preserved — no transliteration, no normalisation.
    # ------------------------------------------------------------------
    all_pairs: list[tuple[str, int]] = []
    for seg in transcript.segments:
        for token in seg.text.split():
            all_pairs.append((token, seg.index))

    if not all_pairs:
        raise AlignError(
            "Corrected transcript has no words to align. "
            "At least one segment must contain text."
        )

    words_only: list[str] = [w for w, _ in all_pairs]

    # ------------------------------------------------------------------
    # 4. Determine audio duration for bounds checking
    # ------------------------------------------------------------------
    audio_duration = _read_audio_duration(audio)

    # ------------------------------------------------------------------
    # 5. Run the aligner (injected fake in tests; WhisperX in production)
    # ------------------------------------------------------------------
    aligner = _aligner if _aligner is not None else make_whisperx_aligner()
    aligner_name = getattr(aligner, "__name__", type(aligner).__name__)

    try:
        timings = aligner(audio, words_only)
    except AlignerError as exc:
        raise AlignError(f"Aligner backend error: {exc}") from exc
    except Exception as exc:
        raise AlignError(f"Aligner failed unexpectedly: {exc}") from exc

    # ------------------------------------------------------------------
    # 6. Validate: word count must match timing count
    # ------------------------------------------------------------------
    if len(timings) != len(all_pairs):
        raise AlignError(
            f"Word-count mismatch: aligner returned {len(timings)} timing(s) "
            f"but the transcript has {len(all_pairs)} word(s). "
            "The aligner must return exactly one timing per word."
        )

    # ------------------------------------------------------------------
    # 7. Build output, validating monotonicity and bounds per word
    # ------------------------------------------------------------------
    output: list[dict] = []
    prev_end: float = -1.0

    for (word, seg_idx), (start, end) in zip(all_pairs, timings, strict=True):
        # end must be strictly after start
        if end <= start:
            raise AlignError(
                f"Word {word!r}: end={end:.4f}s is not after start={start:.4f}s "
                "(each word must have positive duration)."
            )
        # start must be >= 0
        if start < -_MONO_EPSILON:
            raise AlignError(
                f"Word {word!r}: start={start:.4f}s is negative."
            )
        # end must be within audio duration
        if end > audio_duration + _MONO_EPSILON:
            raise AlignError(
                f"Word {word!r}: end={end:.4f}s exceeds audio duration "
                f"{audio_duration:.4f}s."
            )
        # monotonicity: must not overlap previous word (touching allowed)
        if prev_end >= 0 and start < prev_end - _MONO_EPSILON:
            raise AlignError(
                f"Word {word!r}: start={start:.4f}s overlaps the previous word "
                f"(end={prev_end:.4f}s). Word timings must be monotonic."
            )

        output.append(
            {
                "word": word,
                "script": _derive_script(word),
                "start": start,
                "end": end,
                "segment_index": seg_idx,
            }
        )
        prev_end = end

    # ------------------------------------------------------------------
    # 8. Write words.json at the job root (D-021 placement consistency)
    # ------------------------------------------------------------------
    out = ctx.paths.job_dir / "words.json"
    out.write_text(
        json.dumps(output, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    # ------------------------------------------------------------------
    # 9. Log (no secrets; word count and aligner name are safe to log)
    # ------------------------------------------------------------------
    elapsed = time.monotonic() - t0
    ctx.logger.log_stage("align", elapsed, words=len(output), aligner=aligner_name)
