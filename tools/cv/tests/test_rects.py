"""Maximal free rectangles, their labels, and the cross-frame matching rule.

Every occupancy grid here is constructed, so the expected rectangle is
arithmetic rather than a judgement about a photograph.
"""

from __future__ import annotations

import numpy as np
import pytest
from PIL import Image

from framopia_cv.rects import coarsen, free_rectangles, iou, label_kind
from framopia_cv.zones import Rect, compute_zones_generalized, free_rects


def grid(rows: int, cols: int, blocks) -> np.ndarray:
    mask = np.zeros((rows, cols), dtype=bool)
    for y0, y1, x0, x1 in blocks:
        mask[y0:y1, x0:x1] = True
    return mask


class TestCoarsen:
    # Coarsening may only ever shrink a free region: claiming occupied space as
    # free is the error that puts an image on a face.
    def test_a_single_occupied_pixel_occupies_its_whole_cell(self):
        mask = np.zeros((8, 8), dtype=bool)
        mask[3, 3] = True
        assert coarsen(mask, 4)[0, 0]

    def test_an_empty_region_stays_free(self):
        assert not coarsen(np.zeros((8, 8), dtype=bool), 4).any()


class TestFreeRectangles:
    def test_an_empty_frame_is_one_rectangle_covering_it(self):
        rects = free_rectangles(np.zeros((40, 40), dtype=bool), limit=1, factor=1)
        assert rects[0]["cells"] == (40, 40)

    def test_a_full_frame_subject_yields_nothing(self):
        assert free_rectangles(np.ones((40, 40), dtype=bool), limit=3, factor=1) == []

    def test_it_maximizes_the_inscribable_square_not_the_area(self):
        # A 4x40 strip has area 160; a 20x20 block has area 400 but, more to
        # the point, holds a 20-square where the strip holds only a 4-square.
        mask = np.ones((40, 60), dtype=bool)
        mask[0:4, 0:40] = False
        mask[10:30, 40:60] = False
        rects = free_rectangles(mask, limit=1, factor=1)
        assert rects[0]["cells"] == (20, 20)

    def test_extraction_is_greedy_and_non_overlapping(self):
        mask = np.ones((40, 60), dtype=bool)
        mask[0:10, 0:10] = False
        mask[20:40, 20:40] = False
        rects = free_rectangles(mask, limit=2, factor=1)
        assert [r["cells"] for r in rects] == [(20, 20), (10, 10)]

    # The region beside the head and above the shoulders is below the top
    # rectangle's cut and inside the width of the arms, so the three fixed
    # kinds cannot name it. This is that shape.
    def test_it_finds_the_region_the_three_kinds_miss(self):
        # A plus: head column at the top, arms spanning wide lower down.
        mask = grid(100, 100, [(0, 40, 40, 60), (40, 70, 10, 90)])
        found = free_rectangles(mask, limit=4, factor=1)
        beside_head = [
            r for r in found if r["y"] < 0.40 and (r["x"] + r["w"] <= 0.41 or r["x"] >= 0.59)
        ]
        assert beside_head, "no rectangle beside the head was found"

        # The three-kind decomposition's side rectangles are bounded by the
        # arms, so they are narrower than the space beside the head.
        three = free_rects(mask, zone_margin=0.0, min_zone_short_edge=0.0,
                           bottom_exclusion=0.0, lateral_inset=0.0, vertical_inset=0.0)
        assert three["left"] is not None
        assert max(r["w"] for r in beside_head) > three["left"].w


class TestLabelKind:
    PERSON = grid(100, 100, [(0, 40, 40, 60), (40, 70, 10, 90)])

    def test_above_the_topmost_row_is_top(self):
        mask = grid(100, 100, [(30, 70, 40, 60)])
        assert label_kind({"x": 0.0, "y": 0.0, "w": 1.0, "h": 0.25}, mask) == "top"

    def test_beside_the_head_is_labelled_by_side(self):
        # Rows 0-40 hold only the head at columns 40-60, so a rectangle at the
        # left of those rows is beside the person even though the arms below
        # are wider than it.
        assert label_kind({"x": 0.0, "y": 0.0, "w": 0.35, "h": 0.35}, self.PERSON) == "left"
        assert label_kind({"x": 0.65, "y": 0.0, "w": 0.35, "h": 0.35}, self.PERSON) == "right"

    # ARCHITECTURE §3's enum is top|left|right and this session does not invent
    # a fourth value; a rectangle fitting none is reported by returning None.
    def test_a_rectangle_overlapping_the_person_columns_has_no_kind(self):
        # Rows 40-70 hold the arms across columns 10-90, so a rectangle in the
        # middle of them is on neither side.
        assert label_kind({"x": 0.3, "y": 0.45, "w": 0.4, "h": 0.2}, self.PERSON) is None

    def test_rows_holding_nobody_are_sided_against_the_person_centre(self):
        # Below the subject entirely: there is no occupancy to sit beside, so
        # the side is decided against the person's horizontal centre.
        assert label_kind({"x": 0.0, "y": 0.75, "w": 0.3, "h": 0.2}, self.PERSON) == "left"


class TestIou:
    def test_identical_rects_score_one(self):
        r = {"x": 0.1, "y": 0.1, "w": 0.2, "h": 0.2}
        assert iou(r, r) == pytest.approx(1.0)

    def test_disjoint_rects_score_zero(self):
        a = {"x": 0.0, "y": 0.0, "w": 0.2, "h": 0.2}
        b = {"x": 0.5, "y": 0.5, "w": 0.2, "h": 0.2}
        assert iou(a, b) == 0.0


class TestMatchingAcrossFrames:
    """A rectangle that drifts stays one zone; one that jumps becomes two."""

    def write(self, tmp_path, masks):
        frames = []
        for index, mask in enumerate(masks):
            path = tmp_path / f"m{index:03d}.png"
            Image.fromarray((mask * 255).astype(np.uint8), mode="L").save(path)
            frames.append({"maskPath": str(path), "timeS": index * 0.5005})
        return frames

    def person_at(self, left: int) -> np.ndarray:
        # A tall subject leaving a wide free column on one side.
        return grid(240, 240, [(0, 200, left, left + 60)])

    def test_a_drifting_rectangle_stays_one_zone(self, tmp_path):
        masks = [self.person_at(150 + step) for step in (0, 2, 4, 6, 8)]
        result = compute_zones_generalized(
            self.write(tmp_path, masks), zone_margin=0.0, min_zone_short_edge=0.0,
            bottom_exclusion=0.0, lateral_inset=0.0, vertical_inset=0.0,
        )
        lefts = [z for z in result["zones"] if z["kind"] == "left"]
        assert len(lefts) == 1
        assert lefts[0]["valid"][0][1] == pytest.approx(4 * 0.5005)

    def test_a_jumping_rectangle_becomes_two_zones(self, tmp_path):
        # The free column moves from the right of the frame to the left, so no
        # pair of consecutive rectangles overlaps enough to match.
        masks = [self.person_at(10)] * 3 + [self.person_at(170)] * 3
        result = compute_zones_generalized(
            self.write(tmp_path, masks), zone_margin=0.0, min_zone_short_edge=0.0,
            bottom_exclusion=0.0, lateral_inset=0.0, vertical_inset=0.0,
        )
        assert len(result["zones"]) >= 2
        assert result["trackCount"] >= 2
