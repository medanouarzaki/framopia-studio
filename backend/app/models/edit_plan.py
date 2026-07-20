"""Edit Plan — Pydantic v2 models for the central backend↔AE contract (spec §8)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, model_validator


class Word(BaseModel):
    """A single captioned word with its timing, script direction, and emphasis flag."""

    text: str
    script: Literal["arabic", "latin"]
    start: float
    end: float
    emphasis: bool


class CaptionLine(BaseModel):
    """One caption segment: a template name and an ordered list of timed words."""

    segment_index: int
    template: str
    words: list[Word]

    @model_validator(mode="after")
    def check_word_timings(self) -> CaptionLine:
        """Enforce end>start per word and no overlap within a segment (touching allowed)."""
        words = sorted(self.words, key=lambda w: w.start)
        for i, w in enumerate(words):
            if w.end <= w.start:
                raise ValueError(
                    f"Segment {self.segment_index}, word '{w.text}': "
                    f"end ({w.end}) must be > start ({w.start})"
                )
            if i > 0 and words[i - 1].end > w.start:
                raise ValueError(
                    f"Segment {self.segment_index}: words overlap — "
                    f"'{words[i - 1].text}' ends at {words[i - 1].end} "
                    f"but '{w.text}' starts at {w.start}"
                )
        return self


class Reel(BaseModel):
    """Output reel dimensions and timing."""

    width: int
    height: int
    fps: int
    duration: float


class Source(BaseModel):
    """Paths to the input video and extracted audio (relative to the job folder)."""

    video: str
    audio: str


class Visual(BaseModel):
    """A single visual event: generated image, client asset, or animated-text fallback."""

    id: str
    kind: Literal["generated_image", "client_asset", "animated_text"]
    asset: str | None = None
    text: str | None = None
    template: str
    start: float
    end: float
    beat_aligned: bool

    @model_validator(mode="after")
    def check_kind_payload(self) -> Visual:
        """Enforce kind↔payload consistency (spec §12.1)."""
        if self.kind == "animated_text":
            if self.text is None:
                raise ValueError("animated_text visual requires text to be non-null")
            if self.asset is not None:
                raise ValueError("animated_text visual must have asset=null")
        else:
            if self.asset is None:
                raise ValueError(f"{self.kind} visual requires asset to be non-null")
        return self


class Motion(BaseModel):
    """A punch-in or transition motion event.

    punch_in requires target and amount; transition requires neither.
    Both require kind, template, and at. (D-006)
    """

    kind: Literal["punch_in", "transition"]
    template: str
    at: float
    target: str | None = None
    amount: float | None = None

    @model_validator(mode="after")
    def check_punch_in_fields(self) -> Motion:
        """Require target+amount for punch_in; forbid them on transition."""
        if self.kind == "punch_in":
            if self.target is None:
                raise ValueError("punch_in motion requires 'target'")
            if self.amount is None:
                raise ValueError("punch_in motion requires 'amount'")
        return self


class MusicCue(BaseModel):
    """Background music track reference."""

    asset: str
    gain_db: float
    start: float


class SfxCue(BaseModel):
    """A single sound-effect cue placed at an absolute time."""

    asset: str
    at: float
    gain_db: float


class AudioPlan(BaseModel):
    """Combined music + SFX audio description."""

    music: MusicCue
    sfx: list[SfxCue]


class Meta(BaseModel):
    """Job metadata: summary, brief, timestamp, and cost estimate."""

    summary: str
    brief: str
    generated_at: str
    cost_estimate_usd: float


class EditPlan(BaseModel):
    """The complete, validated Edit Plan — the contract between backend and ExtendScript.

    In-plan invariants enforced at construction (spec §8):
      - Caption word times lie within [0, reel.duration]; end > start; no intra-segment overlap.
      - Visual windows lie within [0, reel.duration]; end > start.
      - beat_aligned visuals: START within one frame (1/fps seconds) of some beat. (D-005)
        END is NOT required to be a beat (only within [0, duration]).
    External invariants (template existence, asset presence on disk) are checked by
    validate_edit_plan() in validate.py, not here.
    """

    schema_version: str
    job_id: str
    brand_kit: str
    reel: Reel
    source: Source
    captions: list[CaptionLine]
    visuals: list[Visual]
    motion: list[Motion]
    audio: AudioPlan
    beats: list[float]
    meta: Meta

    @model_validator(mode="after")
    def check_plan_constraints(self) -> EditPlan:
        """Enforce all timing and beat-alignment constraints across the plan."""
        duration = self.reel.duration
        beat_epsilon = 1.0 / self.reel.fps  # one frame — D-005

        # Caption word times within [0, duration]
        for caption in self.captions:
            for word in caption.words:
                if word.start < 0 or word.end > duration:
                    raise ValueError(
                        f"Segment {caption.segment_index}, word '{word.text}': "
                        f"time [{word.start}, {word.end}] exceeds reel duration [0, {duration}]"
                    )

        # Visual windows: [0, duration], end>start, beat alignment on start
        for visual in self.visuals:
            if visual.end <= visual.start:
                raise ValueError(
                    f"Visual {visual.id}: end ({visual.end}) must be > start ({visual.start})"
                )
            if visual.start < 0 or visual.end > duration:
                raise ValueError(
                    f"Visual {visual.id}: window [{visual.start}, {visual.end}] "
                    f"out of reel duration [0, {duration}]"
                )
            if visual.beat_aligned:
                on_beat = any(abs(visual.start - b) <= beat_epsilon for b in self.beats)
                if not on_beat:
                    raise ValueError(
                        f"Visual {visual.id}: beat_aligned=true but start={visual.start} "
                        f"is not within {beat_epsilon:.5f}s (1/{self.reel.fps} fps) "
                        f"of any beat. Beats: {self.beats}"
                    )

        return self
