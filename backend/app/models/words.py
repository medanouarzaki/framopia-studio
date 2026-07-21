"""WordTiming Pydantic model — the per-word entry in words.json (spec Stage 5).

words.json is a flat JSON array of WordTiming objects at the job root.
T-108 (understanding stage) and T-303 (caption building in ExtendScript)
consume this file.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class WordTiming(BaseModel):
    """One word's timing in the forced-alignment output.

    Matches the per-element shape written by the alignment stage (T-107) and
    consumed by the understanding stage (T-108) and the AE caption builder (T-303).
    """

    word: str
    script: Literal["arabic", "latin"]
    start: float
    end: float
    segment_index: int
