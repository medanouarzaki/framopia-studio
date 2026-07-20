"""Tests for Edit Plan models, validator, and the golden example (T-004)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.models.edit_plan import (
    EditPlan,
    Motion,
)
from app.models.validate import EditPlanValidationError, validate_edit_plan

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

GOLDEN_PATH = Path(__file__).parents[2] / "docs" / "edit_plan.example.json"

V1_TEMPLATES = {
    "caption_karaoke_default",
    "image_reveal_slideup",
    "image_reveal_scalein",
    "animtext_bold",
    "punch_soft",
    "transition_whip_pan",
}

# A minimal valid plan dict — base for negative-test mutations.
_BEATS = [0.50, 1.02, 1.55, 2.02, 2.55, 3.05, 3.55, 4.02, 6.05, 9.10]

_MINIMAL: dict = {
    "schema_version": "1.0",
    "job_id": "test-001",
    "brand_kit": "framopia-clientA",
    "reel": {"width": 1080, "height": 1920, "fps": 30, "duration": 12.0},
    "source": {"video": "input.mp4", "audio": "audio.wav"},
    "captions": [
        {
            "segment_index": 0,
            "template": "caption_karaoke_default",
            "words": [
                {"text": "Salam", "script": "latin", "start": 0.30, "end": 0.60, "emphasis": False},
                {"text": "بزاف", "script": "arabic", "start": 0.60, "end": 0.95, "emphasis": True},
                {"text": "ديال", "script": "arabic", "start": 0.95, "end": 1.20, "emphasis": False},
                {"text": "promo", "script": "latin", "start": 1.20, "end": 1.70, "emphasis": True},
            ],
        }
    ],
    "visuals": [
        {
            "id": "v1",
            "kind": "generated_image",
            "asset": "assets/images/v1.png",
            "text": None,
            "template": "image_reveal_slideup",
            "start": 2.02,
            "end": 6.05,
            "beat_aligned": True,
        }
    ],
    "motion": [
        {"kind": "punch_in", "target": "speaker", "at": 4.00, "amount": 1.08, "template": "punch_soft"},
        {"kind": "transition", "template": "transition_whip_pan", "at": 6.05},
    ],
    "audio": {
        "music": {"asset": "assets/audio/track.wav", "gain_db": -14.0, "start": 0.0},
        "sfx": [],
    },
    "beats": _BEATS,
    "meta": {
        "summary": "test",
        "brief": "test",
        "generated_at": "2026-07-20T00:00:00Z",
        "cost_estimate_usd": 0.10,
    },
}


def _plan(**overrides: object) -> dict:
    """Return a copy of _MINIMAL with top-level key overrides applied."""
    import copy
    d = copy.deepcopy(_MINIMAL)
    d.update(overrides)
    return d


# ---------------------------------------------------------------------------
# Golden example
# ---------------------------------------------------------------------------


def test_golden_loads_and_validates() -> None:
    """The committed golden JSON deserializes into EditPlan and passes validate_edit_plan."""
    raw = json.loads(GOLDEN_PATH.read_text(encoding="utf-8"))
    plan = EditPlan.model_validate(raw)
    validate_edit_plan(plan, known_templates=V1_TEMPLATES, check_assets=False)


def test_golden_has_all_three_visual_kinds() -> None:
    """Golden includes generated_image, client_asset, and animated_text."""
    raw = json.loads(GOLDEN_PATH.read_text(encoding="utf-8"))
    plan = EditPlan.model_validate(raw)
    kinds = {v.kind for v in plan.visuals}
    assert kinds == {"generated_image", "client_asset", "animated_text"}


def test_golden_has_punch_and_transition() -> None:
    """Golden includes both punch_in and transition motion items."""
    raw = json.loads(GOLDEN_PATH.read_text(encoding="utf-8"))
    plan = EditPlan.model_validate(raw)
    motion_kinds = {m.kind for m in plan.motion}
    assert "punch_in" in motion_kinds
    assert "transition" in motion_kinds


# ---------------------------------------------------------------------------
# Bidi caption line
# ---------------------------------------------------------------------------


def test_bidi_caption_script_tags() -> None:
    """'Salam بزاف ديال promo' line parses with correct [latin,arabic,arabic,latin] script tags."""
    raw = json.loads(GOLDEN_PATH.read_text(encoding="utf-8"))
    plan = EditPlan.model_validate(raw)
    # First segment, first four words
    first_segment = next(c for c in plan.captions if c.segment_index == 0)
    words = sorted(first_segment.words, key=lambda w: w.start)
    assert len(words) == 4
    scripts = [w.script for w in words]
    assert scripts == ["latin", "arabic", "arabic", "latin"]
    texts = [w.text for w in words]
    assert texts == ["Salam", "بزاف", "ديال", "promo"]


def test_bidi_caption_arabic_logical_codepoint_order() -> None:
    """Guard R2: Arabic words are stored in LOGICAL (Unicode) order, not display-reversed.

    Terminals and some editors visually reverse RTL runs, so we compare codepoints directly.
    بزاف must be U+0628 U+0632 U+0627 U+0641 (ba, zain, alef, fa — logical left-to-right).
    ديال must be U+062F U+064A U+0627 U+0644 (dal, ya, alef, lam — logical left-to-right).
    Any byte-level reversal of the stored strings will break this test immediately.
    """
    raw = json.loads(GOLDEN_PATH.read_text(encoding="utf-8"))
    plan = EditPlan.model_validate(raw)
    first_segment = next(c for c in plan.captions if c.segment_index == 0)
    arabic_words = {w.text: w for w in first_segment.words if w.script == "arabic"}

    # بزاف — ba(0628) zain(0632) alef(0627) fa(0641)
    assert list(arabic_words["بزاف"].text) == ["ب", "ز", "ا", "ف"]
    # ديال — dal(062F) ya(064A) alef(0627) lam(0644)
    assert list(arabic_words["ديال"].text) == ["د", "ي", "ا", "ل"]


def test_bidi_caption_non_overlapping_touching() -> None:
    """Touching word timings (end[i] == start[i+1]) are accepted (not treated as overlap)."""
    raw = json.loads(GOLDEN_PATH.read_text(encoding="utf-8"))
    plan = EditPlan.model_validate(raw)
    first_segment = next(c for c in plan.captions if c.segment_index == 0)
    words = sorted(first_segment.words, key=lambda w: w.start)
    for i in range(len(words) - 1):
        # end[i] <= start[i+1] (touching OK)
        assert words[i].end <= words[i + 1].start


# ---------------------------------------------------------------------------
# Malformed plan — word overlap
# ---------------------------------------------------------------------------


def test_overlapping_words_rejected() -> None:
    """Words whose timings overlap within a segment are rejected at construction."""
    d = _plan()
    # Make word[0].end > word[1].start → overlap
    d["captions"][0]["words"][0]["end"] = 0.80  # overlaps word[1].start=0.60
    with pytest.raises(ValidationError, match="overlap"):
        EditPlan.model_validate(d)


def test_word_end_equal_to_start_rejected() -> None:
    """A word with end == start (zero-length) is rejected."""
    d = _plan()
    d["captions"][0]["words"][0]["end"] = 0.30  # same as start
    with pytest.raises(ValidationError, match="end.*must be.*start|start.*end"):
        EditPlan.model_validate(d)


# ---------------------------------------------------------------------------
# Malformed plan — visual window out of range
# ---------------------------------------------------------------------------


def test_visual_end_beyond_duration_rejected() -> None:
    """Visual whose end exceeds reel.duration is rejected."""
    d = _plan()
    d["visuals"][0]["end"] = 99.0  # beyond duration=12.0
    with pytest.raises(ValidationError, match="duration|out of"):
        EditPlan.model_validate(d)


def test_visual_end_before_start_rejected() -> None:
    """Visual with end <= start is rejected."""
    d = _plan()
    d["visuals"][0]["end"] = 1.00  # before start=2.02
    with pytest.raises(ValidationError, match="end.*must be.*start|start.*end"):
        EditPlan.model_validate(d)


# ---------------------------------------------------------------------------
# Malformed plan — bad script value
# ---------------------------------------------------------------------------


def test_bad_script_value_rejected() -> None:
    """A word with script='english' (not 'arabic' or 'latin') is rejected."""
    d = _plan()
    d["captions"][0]["words"][0]["script"] = "english"
    with pytest.raises(ValidationError):
        EditPlan.model_validate(d)


# ---------------------------------------------------------------------------
# Malformed plan — beat alignment
# ---------------------------------------------------------------------------


def test_beat_aligned_start_not_on_beat_rejected() -> None:
    """A beat_aligned visual whose start is far from every beat is rejected."""
    d = _plan()
    # start=5.00 is not in beats and is >1/30 away from any beat in _BEATS
    d["visuals"][0]["start"] = 5.00
    d["visuals"][0]["end"] = 7.00
    d["visuals"][0]["beat_aligned"] = True
    with pytest.raises(ValidationError, match="beat_aligned|beat"):
        EditPlan.model_validate(d)


def test_beat_aligned_false_start_not_on_beat_accepted() -> None:
    """beat_aligned=False visuals are accepted even if start is not on a beat."""
    d = _plan()
    d["visuals"][0]["start"] = 5.00
    d["visuals"][0]["end"] = 7.00
    d["visuals"][0]["beat_aligned"] = False
    EditPlan.model_validate(d)  # must not raise


# ---------------------------------------------------------------------------
# Malformed plan — kind/payload consistency
# ---------------------------------------------------------------------------


def test_animated_text_no_text_rejected() -> None:
    """animated_text with text=None is rejected."""
    d = _plan()
    d["visuals"][0] = {
        "id": "vX",
        "kind": "animated_text",
        "asset": None,
        "text": None,  # missing
        "template": "animtext_bold",
        "start": 2.02,
        "end": 6.05,
        "beat_aligned": True,
    }
    with pytest.raises(ValidationError, match="text"):
        EditPlan.model_validate(d)


def test_generated_image_no_asset_rejected() -> None:
    """generated_image with asset=None is rejected."""
    d = _plan()
    d["visuals"][0] = {
        "id": "vX",
        "kind": "generated_image",
        "asset": None,  # missing
        "text": None,
        "template": "image_reveal_slideup",
        "start": 2.02,
        "end": 6.05,
        "beat_aligned": True,
    }
    with pytest.raises(ValidationError, match="asset"):
        EditPlan.model_validate(d)


# ---------------------------------------------------------------------------
# External validator — template check
# ---------------------------------------------------------------------------


def test_unknown_template_rejected() -> None:
    """validate_edit_plan raises EditPlanValidationError for an unknown template."""
    raw = json.loads(GOLDEN_PATH.read_text(encoding="utf-8"))
    plan = EditPlan.model_validate(raw)
    restricted = V1_TEMPLATES - {"animtext_bold"}  # omit one used by golden
    with pytest.raises(EditPlanValidationError, match="animtext_bold"):
        validate_edit_plan(plan, known_templates=restricted)


def test_known_templates_none_skips_check() -> None:
    """validate_edit_plan with known_templates=None skips the template check."""
    raw = json.loads(GOLDEN_PATH.read_text(encoding="utf-8"))
    plan = EditPlan.model_validate(raw)
    validate_edit_plan(plan, known_templates=None)  # must not raise


# ---------------------------------------------------------------------------
# Motion model
# ---------------------------------------------------------------------------


def test_punch_in_requires_target_and_amount() -> None:
    """Motion punch_in without target or amount is rejected."""
    with pytest.raises(ValidationError, match="target|amount"):
        Motion(kind="punch_in", template="punch_soft", at=4.0)


def test_transition_accepts_no_target_amount() -> None:
    """Motion transition without target/amount is accepted."""
    m = Motion(kind="transition", template="transition_whip_pan", at=6.05)
    assert m.kind == "transition"
    assert m.target is None
    assert m.amount is None
