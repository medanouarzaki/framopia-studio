"""ASR pipeline stage — spec Stage 3 / §11.2.

Reads job_dir/audio.wav (produced by T-103), calls Gemini transcription with
the §11.2 mixed-script prompt from app/prompts/asr.md, and writes the shaped
result to job_dir/transcript_raw.json.

transcript_raw.json lives at the JOB ROOT (not under assets/), consistent with
audio.wav placement (D-021).

## Mixed-script rule (LOCKED — §11.2 / BUILD_STATE §4)

The ASR prompt (app/prompts/asr.md) encodes this rule directly:
  French / English / technical words → Latin script (marketing, promo, WhatsApp)
  Darija / Arabic words              → Arabic script (سلام، بزاف، كيفاش)

This stage DOES NOT re-decide or relax the rule. The prompt file is editable
by humans; the rule itself is locked.

## Injection seam for tests

``run_asr`` accepts an optional ``_gemini_client`` keyword argument. Production
callers leave it None (a real GeminiClient is created internally). Tests pass a
``GeminiClient(transport=<fixture>, backoff_s=0)`` instance to avoid any network
call. To wire this into the stage runner, wrap in a closure or use partial::

    import functools
    client = GeminiClient(transport=my_transport, backoff_s=0)
    stage = Stage(name="asr", run=functools.partial(run_asr, _gemini_client=client))
"""

from __future__ import annotations

import json
import time
from pathlib import Path

from app.clients.gemini import GeminiClient
from app.jobs.manager import JobContext

_PROMPT_PATH: Path = Path(__file__).parent.parent / "prompts" / "asr.md"


class AsrError(RuntimeError):
    """Raised when the ASR stage fails.

    The message is human-readable and safe to surface to the operator.
    """


async def run_asr(
    ctx: JobContext,
    *,
    _gemini_client: GeminiClient | None = None,
) -> None:
    """ASR stage entry point.

    Called by the T-101 stage runner via Stage(name="asr", run=run_asr).
    Raises AsrError on any failure so the runner sets job state to ERROR.

    Args:
        ctx: The job context provided by the runner.
        _gemini_client: Injectable GeminiClient for tests. Leave None in production.
    """
    t0 = time.monotonic()

    # ------------------------------------------------------------------
    # 1. Verify audio.wav is present (T-103 must have run first)
    # ------------------------------------------------------------------
    audio = ctx.paths.job_dir / "audio.wav"
    if not audio.exists():
        raise AsrError(
            f"audio.wav not found at {audio}. "
            "Run the audio-extraction stage (T-103) before the ASR stage."
        )
    if not audio.is_file():
        raise AsrError(f"audio.wav is not a regular file: {audio}")

    # ------------------------------------------------------------------
    # 2. Load the ASR prompt (§11.2 mixed-script rule)
    # ------------------------------------------------------------------
    try:
        prompt = _PROMPT_PATH.read_text(encoding="utf-8")
    except OSError as exc:
        raise AsrError(f"Could not read ASR prompt from {_PROMPT_PATH}: {exc}") from exc

    # ------------------------------------------------------------------
    # 3. Transcribe via Gemini
    # ------------------------------------------------------------------
    client = _gemini_client if _gemini_client is not None else GeminiClient()
    result = client.transcribe(audio, prompt=prompt, brief=ctx.job.brief)

    # ------------------------------------------------------------------
    # 4. Shape into transcript_raw.json
    # ------------------------------------------------------------------
    segments = [
        {
            "index": i,
            "text": seg.text,
            "start": seg.start,
            "end": seg.end,
            "confidence": seg.confidence,
            **({"script": seg.script} if seg.script is not None else {}),
        }
        for i, seg in enumerate(result.segments)
    ]

    transcript = {
        "job_id": ctx.job.job_id,
        "model_id": result.model_id,
        "segments": segments,
    }

    out = ctx.paths.job_dir / "transcript_raw.json"
    out.write_text(
        json.dumps(transcript, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    # ------------------------------------------------------------------
    # 5. Log completion (no secrets — never log the api key or payload)
    # ------------------------------------------------------------------
    elapsed = time.monotonic() - t0
    ctx.logger.log_stage("asr", elapsed, segments=len(segments))
