"""Understanding & segmentation stage — spec Stage 6 / §11.3.

Reads job_dir/transcript_corrected.json (from T-106) and job_dir/words.json
(from T-107), calls Gemini to reason over the content and operator brief, and
writes job_dir/understanding.json (flat at the job root, consistent with D-021).

Output shape (Understanding Pydantic model):
    {
      "summary": "<one paragraph>",
      "segments": [
        { "index": <int>, "text": <str>, "start": <float>, "end": <float>,
          "visual_intent": <str>,
          "emphasis_word_indices": [<int>, ...] }
      ]
    }

Emphasis indices (spec §11.3):
    Global indices into words.json (0-based). The stage validates that every
    emitted index is in range [0, len(words) - 1]. Out-of-range indices → error.

BIDI display trap (BUILD_STATE §5 item 3):
    Arabic text is stored in LOGICAL codepoint order. understanding.json is
    written with ensure_ascii=False. Never "fix" reversed-looking Arabic.

## Injection seam for tests

run_understand accepts an optional _gemini_client keyword argument.
Leave it None in production (a real GeminiClient is created internally).
In tests inject a fixture-backed client via partial::

    import functools
    client = GeminiClient(transport=my_transport, backoff_s=0)
    stage = Stage(name="understand", run=functools.partial(run_understand, _gemini_client=client))
"""

from __future__ import annotations

import json
import time
from pathlib import Path

from app.clients.gemini import GeminiClient
from app.jobs.manager import JobContext
from app.models.understanding import Understanding

_PROMPT_PATH: Path = Path(__file__).parent.parent / "prompts" / "understand.md"


class UnderstandError(RuntimeError):
    """Raised when the understanding stage fails.

    The message is human-readable and safe to surface to the operator.
    """


async def run_understand(
    ctx: JobContext,
    *,
    _gemini_client: GeminiClient | None = None,
) -> None:
    """Understanding stage entry point.

    Called by the T-101 stage runner via Stage(name="understand", run=run_understand).
    Raises UnderstandError on any failure so the runner sets job state to ERROR.

    Args:
        ctx:            Job context from the runner.
        _gemini_client: Injectable GeminiClient for tests. Leave None in production.
    """
    t0 = time.monotonic()

    # ------------------------------------------------------------------
    # 1. Verify both inputs exist
    # ------------------------------------------------------------------
    corrected = ctx.paths.job_dir / "transcript_corrected.json"
    words_path = ctx.paths.job_dir / "words.json"

    if not corrected.exists() or not corrected.is_file():
        raise UnderstandError(
            f"transcript_corrected.json not found at {corrected}. "
            "Run the correction gate (T-106) before the understanding stage."
        )
    if not words_path.exists() or not words_path.is_file():
        raise UnderstandError(
            f"words.json not found at {words_path}. "
            "Run the forced-alignment stage (T-107) before the understanding stage."
        )

    # ------------------------------------------------------------------
    # 2. Read and validate inputs
    # ------------------------------------------------------------------
    try:
        corrected_data = json.loads(corrected.read_text(encoding="utf-8"))
    except Exception as exc:
        raise UnderstandError(
            f"Could not read transcript_corrected.json: {exc}"
        ) from exc

    try:
        words: list[dict] = json.loads(words_path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise UnderstandError(f"Could not read words.json: {exc}") from exc

    if not isinstance(words, list):
        raise UnderstandError("words.json must be a JSON array.")

    word_count = len(words)

    # ------------------------------------------------------------------
    # 3. Build transcript text for the Gemini call
    # ------------------------------------------------------------------
    transcript_text = json.dumps(corrected_data, ensure_ascii=False)

    # ------------------------------------------------------------------
    # 4. Load the understanding prompt (§11.3 emphasis rule)
    # ------------------------------------------------------------------
    try:
        prompt = _PROMPT_PATH.read_text(encoding="utf-8")
    except OSError as exc:
        raise UnderstandError(
            f"Could not read understanding prompt from {_PROMPT_PATH}: {exc}"
        ) from exc

    # ------------------------------------------------------------------
    # 5. Call Gemini (injected fixture transport in tests)
    # ------------------------------------------------------------------
    client = _gemini_client if _gemini_client is not None else GeminiClient()
    result = client.understand(
        transcript=transcript_text,
        words=words,
        brief=ctx.job.brief,
        prompt=prompt,
    )

    # ------------------------------------------------------------------
    # 6. Parse model output as JSON
    # ------------------------------------------------------------------
    raw = result.raw_text.strip()
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise UnderstandError(
            f"Gemini returned invalid JSON for the understanding stage: {exc}\n"
            f"Raw output (first 200 chars): {raw[:200]!r}"
        ) from exc

    # ------------------------------------------------------------------
    # 7. Validate against the Understanding Pydantic model
    # ------------------------------------------------------------------
    try:
        understanding = Understanding.model_validate(parsed)
    except Exception as exc:
        raise UnderstandError(
            f"Understanding output failed schema validation: {exc}"
        ) from exc

    # ------------------------------------------------------------------
    # 8. Validate per-segment constraints (fail loud — spec §20)
    # ------------------------------------------------------------------
    for seg in understanding.segments:
        # visual_intent must be present and non-empty
        if not seg.visual_intent or not seg.visual_intent.strip():
            raise UnderstandError(
                f"Segment {seg.index!r} has an empty visual_intent. "
                'Every segment must have a non-empty visual_intent (or "speaker only").'
            )
        # emphasis_word_indices must be in range
        for idx in seg.emphasis_word_indices:
            if idx < 0 or idx >= word_count:
                raise UnderstandError(
                    f"Segment {seg.index!r}: emphasis_word_indices contains {idx}, "
                    f"which is out of range for words.json (0…{word_count - 1}). "
                    "Indices must reference real words from the word list."
                )

    # ------------------------------------------------------------------
    # 9. Write understanding.json at the job root (D-021)
    # ------------------------------------------------------------------
    out = ctx.paths.job_dir / "understanding.json"
    out.write_text(
        json.dumps(understanding.model_dump(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    # ------------------------------------------------------------------
    # 10. Log (no secrets; segment count is safe to log)
    # ------------------------------------------------------------------
    elapsed = time.monotonic() - t0
    ctx.logger.log_stage(
        "understand",
        elapsed,
        segments=len(understanding.segments),
        words=word_count,
    )
