"""Pydantic model for music/library.json entries (spec §13.1, Stage 9)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class MusicLibraryEntry(BaseModel):
    """One music or SFX asset tagged in music/library.json.

    ``file`` is a filename relative to the music/ directory (the actual audio
    file is git-ignored; only this metadata is committed).
    """

    file: str
    type: Literal["music", "sfx"]
    mood: list[str] = Field(default_factory=list)
    energy: int = Field(ge=1, le=5)
    bpm: float
    has_vocals: bool
    duration: float
