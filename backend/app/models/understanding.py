"""Pydantic models for the understanding stage output (spec Stage 6 / §11.3)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class UnderstandingSegment(BaseModel):
    """One semantic segment from the understanding stage.

    ``emphasis_word_indices`` are global indices into the ``words.json`` flat
    list produced by the forced-alignment stage (T-107).
    """

    index: int
    text: str
    start: float
    end: float
    visual_intent: str
    emphasis_word_indices: list[int] = Field(default_factory=list)


class Understanding(BaseModel):
    """Root model for ``understanding.json`` (job root, D-021)."""

    summary: str
    segments: list[UnderstandingSegment] = Field(default_factory=list)
