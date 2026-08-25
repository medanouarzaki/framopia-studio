"""Zone derivation: component filtering, free-rectangle geometry, hysteresis.

Every mask here is constructed, so the expected rectangle is arithmetic rather
than a judgement about a photograph. The corpus renders are what check the
constants against real footage; these check that the code computes what the
constants say.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from framopia_cv.zones import (
    BOTTOM_EXCLUSION,
    LATERAL_INSET,
    MIN_ZONE_AREA,
    VERTICAL_INSET,
    ZONE_MARGIN,
    Rect,
    compute_zones,
    filter_components,
    free_rects,
    hysteresis_windows,
)

CV_DIR = Path(__file__).resolve().parent.parent


def person(height: int, width: int, top: int, bottom: int, left: int, right: int) -> np.ndarray:
    """A rectangular subject; `bottom` and `right` are exclusive."""
    mask = np.zeros((height, width), dtype=bool)
    mask[top:bottom, left:right] = True
    return mask


class TestFilterComponents:
    def test_drops_a_speck_and_keeps_the_subject(self):
        mask = person(100, 100, 30, 80, 40, 60)
        mask[5, 5] = True
        filtered = filter_components(mask, floor=0.001)
        assert filtered[30, 40]
        assert not filtered[5, 5]

    # `>=` is the boundary, so a component exactly at the floor survives. The
    # bias is asymmetric on purpose: a retained speck shrinks a zone, a
    # dropped limb puts an image on top of a hand.
    def test_a_component_exactly_at_the_floor_is_kept(self):
        mask = person(100, 100, 30, 80, 40, 60)
        mask[5, 0:10] = True  # 10 px of a 10000 px frame, exactly 0.001
        filtered = filter_components(mask, floor=0.001)
        assert filtered[5, 0:10].all()

    def test_a_component_one_pixel_under_the_floor_is_dropped(self):
        mask = person(100, 100, 30, 80, 40, 60)
        mask[5, 0:9] = True
        filtered = filter_components(mask, floor=0.001)
        assert not filtered[5, 0:9].any()

    def test_an_empty_mask_survives_filtering(self):
        assert not filter_components(np.zeros((10, 10), dtype=bool)).any()

    def test_the_mask_argument_is_not_mutated(self):
        mask = person(100, 100, 30, 80, 40, 60)
        mask[5, 5] = True
        before = mask.copy()
        filter_components(mask, floor=0.001)
        assert np.array_equal(mask, before)


class TestFreeRects:
    # Subject at rows 30-79, columns 40-59 of a 100x100 frame.
    @pytest.fixture
    def mask(self) -> np.ndarray:
        return person(100, 100, 30, 80, 40, 60)

    def test_top_runs_from_the_frame_edge_to_the_first_occupied_row(self, mask):
        top = free_rects(mask)["top"]
        assert top is not None
        assert top.x == pytest.approx(LATERAL_INSET)
        assert top.y == pytest.approx(0.0)
        assert top.w == pytest.approx(1.0 - 2 * LATERAL_INSET)
        assert top.h == pytest.approx(0.30 - ZONE_MARGIN)

    def test_left_ends_a_margin_before_the_first_occupied_column(self, mask):
        left = free_rects(mask)["left"]
        assert left is not None
        assert left.x == pytest.approx(0.0)
        assert left.w == pytest.approx(0.40 - ZONE_MARGIN)

    def test_right_starts_a_margin_after_the_last_occupied_column(self, mask):
        right = free_rects(mask)["right"]
        assert right is not None
        # Column 59 is the last occupied one, so the subject ends at 0.60.
        assert right.x == pytest.approx(0.60 + ZONE_MARGIN)
        assert right.w == pytest.approx(1.0 - (0.60 + ZONE_MARGIN))

    def test_side_zones_stop_above_the_bottom_exclusion(self, mask):
        left = free_rects(mask)["left"]
        assert left is not None
        assert left.y == pytest.approx(VERTICAL_INSET)
        assert left.y + left.h == pytest.approx(1.0 - BOTTOM_EXCLUSION)

    def test_a_rectangle_under_the_minimum_area_is_discarded(self, mask):
        # A subject reaching almost to the left edge leaves a sliver, which is
        # worse than nothing: the solver would treat it as a real option.
        narrow = person(100, 100, 30, 80, 4, 60)
        assert free_rects(narrow)["left"] is None

    def test_a_person_filling_the_frame_yields_no_zones(self):
        rects = free_rects(np.ones((100, 100), dtype=bool))
        assert rects == {"top": None, "left": None, "right": None}


class TestBottomExclusion:
    def test_free_space_only_inside_the_excluded_band_yields_no_zone(self):
        # Occupied everywhere above the exclusion, clear below it. The only
        # free space is in the band no image may ever be placed in.
        mask = np.zeros((100, 100), dtype=bool)
        mask[0:85, :] = True
        assert free_rects(mask) == {"top": None, "left": None, "right": None}

    def test_an_occupied_column_only_inside_the_band_does_not_kill_a_side_zone(self):
        # A skirt flaring left at the hem sits inside the excluded band. The
        # left zone does not reach there, so it is not blocked by it.
        mask = person(100, 100, 30, 80, 40, 60)
        mask[88:96, 0:20] = True
        left = free_rects(mask)["left"]
        assert left is not None
        assert left.w == pytest.approx(0.40 - ZONE_MARGIN)


class TestHysteresis:
    R = Rect(0.0, 0.0, 1.0, 1.0)

    def rects(self, pattern: str) -> list[Rect | None]:
        return [self.R if char == "x" else None for char in pattern]

    def times(self, pattern: str) -> list[float]:
        return [index * 0.5 for index in range(len(pattern))]

    def windows(self, pattern: str, **kwargs):
        return hysteresis_windows(self.rects(pattern), self.times(pattern), **kwargs)

    def test_one_free_sample_does_not_open_a_zone(self):
        assert self.windows("x..") == []

    def test_two_consecutive_free_samples_open_a_zone(self):
        (start, end, _), = self.windows("xx.")
        assert (start, end) == (0.0, 0.5)

    # The window is credited from the first sample of the run, not from the
    # sample that satisfied the count: the zone was free for both.
    def test_the_window_starts_at_the_first_sample_of_the_run(self):
        (start, _, _), = self.windows(".xxx")
        assert start == pytest.approx(0.5)

    def test_a_single_missing_sample_closes_the_zone_at_the_default_setting(self):
        # OPEN 2 / CLOSE 1 is the ruled behaviour: closing is deliberately
        # eager, because a zone that flickers open is a placement that
        # flickers, while closing early only costs an opportunity.
        assert len(self.windows("xx.xx")) == 2

    def test_a_single_dropout_survives_when_closing_needs_two_samples(self):
        windows = self.windows("xx.xx", close_samples=2)
        assert len(windows) == 1
        assert windows[0][1] == pytest.approx(2.0)

    def test_a_two_sample_gap_does_not_reopen_a_zone_early(self):
        # The leading pair opens and closes one window. After the gap a single
        # free sample is not enough, so no second window appears.
        windows = self.windows("xx..x")
        assert len(windows) == 1
        assert (windows[0][0], windows[0][1]) == (0.0, 0.5)

    def test_a_two_sample_gap_reopens_only_after_two_free_samples(self):
        windows = self.windows("xx..xx")
        assert len(windows) == 2
        assert windows[1][0] == pytest.approx(2.0)

    def test_the_emitted_rect_is_the_intersection_across_the_window(self):
        rects = [Rect(0.0, 0.0, 0.5, 1.0), Rect(0.1, 0.0, 0.5, 1.0), Rect(0.0, 0.2, 0.5, 0.6)]
        (_, _, merged), = hysteresis_windows(rects, [0.0, 0.5, 1.0])
        assert merged.x == pytest.approx(0.1)
        assert merged.x + merged.w == pytest.approx(0.5)
        assert merged.y == pytest.approx(0.2)
        assert merged.h == pytest.approx(0.6)

    def test_a_mismatched_timestamp_count_is_refused(self):
        with pytest.raises(ValueError):
            hysteresis_windows([self.R], [0.0, 0.5])


class TestNormalizedInvariance:
    """The same subject at two working sizes must give the same rectangles.

    Nothing downstream may depend on 540x960; a later change of working size
    must not move a zone.
    """

    def test_rects_match_at_two_resolutions(self):
        small = free_rects(person(100, 100, 30, 80, 40, 60))
        large = free_rects(person(200, 200, 60, 160, 80, 120))
        for kind in ("top", "left", "right"):
            assert small[kind] is not None and large[kind] is not None
            for axis in ("x", "y", "w", "h"):
                assert getattr(small[kind], axis) == pytest.approx(getattr(large[kind], axis))


class TestComputeZones:
    def write(self, directory: Path, masks: list[np.ndarray]) -> list[dict]:
        frames = []
        for index, mask in enumerate(masks):
            path = directory / f"m{index:03d}.png"
            Image.fromarray((mask * 255).astype(np.uint8), mode="L").save(path)
            frames.append({"maskPath": str(path), "timeS": index * 0.5005})
        return frames

    def test_emits_zones_in_the_architecture_shape(self, tmp_path: Path):
        frames = self.write(tmp_path, [person(100, 100, 30, 80, 40, 60)] * 4)
        result = compute_zones(frames)
        assert {zone["kind"] for zone in result["zones"]} == {"top", "left", "right"}
        for zone in result["zones"]:
            assert set(zone) == {"id", "kind", "rect", "valid", "manual"}
            assert set(zone["rect"]) == {"x", "y", "w", "h"}
            assert zone["manual"] is False
            assert zone["valid"] == [[0.0, pytest.approx(1.5015)]]

    # Validity windows are cut on the manifest's real presentation timestamps,
    # never on index/sampleFps: the reels are 30000/1001 and the two diverge.
    def test_windows_use_the_supplied_timestamps(self, tmp_path: Path):
        frames = self.write(tmp_path, [person(100, 100, 30, 80, 40, 60)] * 3)
        (start, end) = compute_zones(frames)["zones"][0]["valid"][0]
        assert (start, end) == (0.0, pytest.approx(1.0010))

    def test_a_full_frame_subject_yields_no_zones_without_crashing(self, tmp_path: Path):
        frames = self.write(tmp_path, [np.ones((100, 100), dtype=bool)] * 4)
        result = compute_zones(frames)
        assert result["zones"] == []
        assert result["emptySamples"] == 4

    def test_no_frames_is_refused(self):
        with pytest.raises(ValueError):
            compute_zones([])

    def test_a_missing_mask_is_a_named_failure(self, tmp_path: Path):
        completed = subprocess.run(
            [sys.executable, "-m", "framopia_cv.cli"],
            input=json.dumps(
                {
                    "task": "compute_zones",
                    "frames": [{"maskPath": str(tmp_path / "absent.png"), "timeS": 0.0}],
                }
            ),
            capture_output=True,
            text=True,
            cwd=CV_DIR,
        )
        payload = json.loads(completed.stdout)
        assert completed.returncode == 1
        assert payload["ok"] is False
        assert "absent.png" in payload["error"]

    def test_the_constants_are_echoed_with_the_result(self, tmp_path: Path):
        frames = self.write(tmp_path, [person(100, 100, 30, 80, 40, 60)] * 3)
        completed = subprocess.run(
            [sys.executable, "-m", "framopia_cv.cli"],
            input=json.dumps({"task": "compute_zones", "frames": frames, "sampleFps": 2}),
            capture_output=True,
            text=True,
            cwd=CV_DIR,
        )
        payload = json.loads(completed.stdout)
        assert payload["ok"] is True
        assert payload["params"]["min_zone_area"] == MIN_ZONE_AREA
        assert payload["params"]["bottom_exclusion"] == BOTTOM_EXCLUSION
        assert payload["sampleFps"] == 2
