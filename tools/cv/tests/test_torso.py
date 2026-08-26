"""Torso zones: the head bound, the no-room case, and the threshold.

Every mask here is constructed, so the head's lowest pixel is known by
arithmetic rather than judged from a photograph.
"""

from __future__ import annotations

import numpy as np
import pytest
from PIL import Image

from framopia_cv.zones import (
    BOTTOM_EXCLUSION,
    HEAD_CLEARANCE,
    HEAD_THRESHOLD,
    compute_zones_generalized,
    head_bottom_y,
    torso_rect,
)

# The provisional subtitle band's top edge, passed in rather than mirrored:
# it is declared once, in service/src/placement/constants.ts.
SUBTITLE_BAND_Y = 0.75 - 600 / 3840 / 2

ROWS, COLS = 960, 540
ASPECT = ROWS / COLS


def person(top: int, bottom: int, left: int, right: int) -> np.ndarray:
    mask = np.zeros((ROWS, COLS), dtype=bool)
    mask[top:bottom, left:right] = True
    return mask


def head(bottom_row: int, confidence: float = 1.0) -> np.ndarray:
    values = np.zeros((ROWS, COLS), dtype=np.float64)
    values[100:bottom_row, 200:340] = confidence
    return values


class TestHeadBottom:
    def test_it_is_the_row_below_the_last_head_pixel(self):
        assert head_bottom_y(head(480)) == pytest.approx(480 / ROWS)

    def test_no_head_has_no_bottom(self):
        assert head_bottom_y(np.zeros((ROWS, COLS))) is None

    # The head mask is a confidence map and 0.5 trims exactly the low-confidence
    # pixels at hair edges and jaw boundaries, which is where under-coverage
    # would come from.
    def test_the_lower_threshold_includes_pixels_the_higher_one_excludes(self):
        soft = head(480, confidence=0.35)
        assert head_bottom_y(soft, 0.25) == pytest.approx(480 / ROWS)
        assert head_bottom_y(soft, 0.5) is None

    def test_a_soft_hair_edge_extends_the_bound(self):
        values = head(400)
        values[400:470, 240:300] = 0.35  # a soft fringe below the solid head
        assert head_bottom_y(values, 0.5) == pytest.approx(400 / ROWS)
        assert head_bottom_y(values, 0.25) == pytest.approx(470 / ROWS)


class TestTorsoRect:
    BODY = person(100, 900, 150, 400)

    def test_the_top_edge_is_the_head_bottom_plus_clearance(self):
        rect = torso_rect(self.BODY, head(480), SUBTITLE_BAND_Y)
        assert rect is not None
        assert rect.y == pytest.approx(480 / ROWS + HEAD_CLEARANCE / ASPECT)

    def test_the_bottom_edge_is_whichever_bound_sits_higher(self):
        rect = torso_rect(self.BODY, head(480), SUBTITLE_BAND_Y)
        assert rect is not None
        # The subtitle band starts at 0.672, above the exclusion at 0.85.
        assert SUBTITLE_BAND_Y < 1 - BOTTOM_EXCLUSION
        assert rect.y + rect.h == pytest.approx(SUBTITLE_BAND_Y)

    # A torso zone sits ON the body, so it is bounded by where the body is.
    def test_it_is_bounded_laterally_by_the_body_not_the_background(self):
        rect = torso_rect(self.BODY, head(480), SUBTITLE_BAND_Y)
        assert rect is not None
        assert rect.x == pytest.approx(150 / COLS)
        assert rect.x + rect.w == pytest.approx(400 / COLS)

    # Ruling 3: emitting no torso zone is a correct outcome, not a failure.
    def test_a_head_reaching_past_the_bound_yields_no_zone(self):
        assert torso_rect(self.BODY, head(700), SUBTITLE_BAND_Y) is None

    def test_a_head_below_the_bottom_exclusion_yields_no_zone(self):
        assert torso_rect(self.BODY, head(int(ROWS * 0.9)), SUBTITLE_BAND_Y) is None

    def test_no_head_at_all_yields_no_zone(self):
        # Nothing here can establish where the face is, so nothing is offered.
        assert torso_rect(self.BODY, np.zeros((ROWS, COLS)), SUBTITLE_BAND_Y) is None

    def test_a_body_absent_from_the_torso_rows_yields_no_zone(self):
        # The body stops above where the torso zone would start, so there is
        # nothing to sit on.
        assert torso_rect(person(100, 300, 150, 400), head(300), SUBTITLE_BAND_Y) is None


class TestTorsoAcrossFrames:
    """The window's rectangle must clear the lowest head pixel of every frame."""

    def write(self, tmp_path, bodies, heads):
        frames = []
        for index, (body, head_values) in enumerate(zip(bodies, heads)):
            body_path = tmp_path / f"b{index:03d}.png"
            head_path = tmp_path / f"h{index:03d}.png"
            Image.fromarray((body * 255).astype(np.uint8), mode="L").save(body_path)
            Image.fromarray(np.round(head_values * 255).astype(np.uint8), mode="L").save(head_path)
            frames.append(
                {
                    "maskPath": str(body_path),
                    "headMaskPath": str(head_path),
                    "timeS": index * 0.5005,
                }
            )
        return frames

    def test_no_emitted_zone_contains_a_frame_whose_head_intrudes(self, tmp_path):
        """Ruling 3, asserted as the property rather than as a mechanism.

        A frame whose head drops lower either shrinks its window's rectangle or
        fails the IoU match and splits the window in two. Both satisfy the
        ruling; what must never happen is an emitted rectangle overlapping a
        head pixel on any frame it claims.
        """
        bodies = [person(100, 900, 150, 400)] * 6
        heads = [head(400), head(400), head(520), head(400), head(400), head(400)]
        frames = self.write(tmp_path, bodies, heads)
        result = compute_zones_generalized(frames, subtitle_band_y=SUBTITLE_BAND_Y)

        torso = [z for z in result["zones"] if z["kind"] == "torso"]
        assert torso, "expected at least one torso zone"
        for zone in torso:
            for (start, end) in zone["valid"]:
                for frame, values in zip(frames, heads):
                    if not start - 1e-9 <= frame["timeS"] <= end + 1e-9:
                        continue
                    bound = head_bottom_y(values, HEAD_THRESHOLD)
                    assert bound is not None
                    assert zone["rect"]["y"] >= bound + HEAD_CLEARANCE / ASPECT - 1e-9

    def test_a_reel_whose_head_always_blocks_the_band_gets_no_torso_zone(self, tmp_path):
        bodies = [person(100, 900, 150, 400)] * 4
        heads = [head(700)] * 4
        result = compute_zones_generalized(
            self.write(tmp_path, bodies, heads), subtitle_band_y=SUBTITLE_BAND_Y
        )
        assert [z for z in result["zones"] if z["kind"] == "torso"] == []

    def test_no_subtitle_band_means_no_torso_zone(self, tmp_path):
        # The band is declared in TypeScript; without it being passed in there
        # is no lower bound to derive one against.
        frames = self.write(tmp_path, [person(100, 900, 150, 400)] * 4, [head(400)] * 4)
        result = compute_zones_generalized(frames)
        assert [z for z in result["zones"] if z["kind"] == "torso"] == []
