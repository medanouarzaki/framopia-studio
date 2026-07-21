"""Transcript Pydantic models — shared shape for transcript_raw.json and transcript_corrected.json.

Both the ASR stage output (T-105) and the correction gate POST body use this shape.
Field-for-field consistency ensures raw and corrected transcripts are interchangeable
as inputs to T-107 (forced alignment).
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class TranscriptSegment(BaseModel):
    """One timed caption segment.

    Matches the per-element shape written by run_asr (T-105) and accepted by
    POST /jobs/{id}/transcript (T-106).
    """

    index: int
    text: str
    start: float | None = None
    end: float | None = None
    confidence: float | None = None
    script: str | None = None  # "arabic" | "latin" | None  — §11.2 hint


class Transcript(BaseModel):
    """Full transcript document.

    The same shape is used for:
    - transcript_raw.json  (written by the ASR stage)
    - transcript_corrected.json (written by the correction gate endpoint)
    - GET /jobs/{id}/transcript response body
    - POST /jobs/{id}/transcript request body

    When the operator POSTs a corrected transcript, the server overrides job_id
    from the URL parameter (D-027) so the file is always self-consistent.
    """

    job_id: str
    model_id: str
    segments: list[TranscriptSegment] = Field(default_factory=list)
