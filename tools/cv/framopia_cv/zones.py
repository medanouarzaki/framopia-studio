"""Negative-space zones from person masks, ARCHITECTURE §1.4 and §5.5.

Zones are derived from the mask, never from the bounding box. Session 1
measured person pixels at ~0.25 of the frame against a median bounding box of
~0.64 of it: the subject fills about two-fifths of its own box, and the rest
is negative space beside the head and between the arms that a box-derived
zone would throw away. `person_stats`' bbox stays reported metadata and is not
an input here.

The pipeline is per-frame free rectangles, then a temporal reduction with
hysteresis into stable zones and validity windows.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

# Every constant below is in frame-normalized units, and every one of them is
# CHOSEN, NOT MEASURED. They were declared before the corpus was run and none
# has been tuned to improve the output.

# A component smaller than this fraction of the frame is treated as matte
# noise and excluded from the person footprint. Set from the corpus
# distribution of non-largest components, which decays smoothly from 1px with
# no natural gap: 0.0001 of a 540x960 frame is 52px, well under any limb at
# this working size, while the smallest plausible fingertip is around 100px.
# The bias is deliberately asymmetric — a retained speck shrinks a zone, a
# dropped hand puts a generated image on top of a hand — so where the
# histogram is ambiguous this takes the lower floor.
PERSON_COMPONENT_FLOOR = 0.0001

# Clearance between the subject and the nearest zone edge, so a zone never
# abuts the person and a mask a pixel or two tight does not read as touching.
ZONE_MARGIN = 0.02

# The smallest rectangle worth emitting, as its SHORT EDGE in units of frame
# width. Generated images are 1:1 (DECISION-image-config), so the largest
# square a zone can hold is bounded by its short edge alone; area lets one long
# dimension pay for a fatally short one, and a 0.052 x 0.800 strip passed a
# 0.03 area floor at 113px wide on a 2160-wide frame. 0.15 is 324px, roughly a
# quarter of TEMPLATE_LIBRARY_GUIDE §3's 1200x1200 comp working size, below
# which a placed image reads as a stamp rather than a design element.
#
# CHOSEN, NOT MEASURED. The corpus separates one clear outlier at 113px from a
# cluster at 253px and up, so any value in 0.06-0.11 would remove only that
# outlier; 0.15 additionally removes two borderline zones at 253px and 285px.
MIN_ZONE_SHORT_EDGE = 0.15

# No image is ever placed at the bottom of a 9:16 frame. A product rule, ruled
# by the user, not a correction for anything in the mask: session 2 measured
# mask coverage in this band as higher than over the rest of the frame on all
# five reels. Left and right zones are clipped to end above it and the top zone
# is unaffected. It costs 0.0% of total valid zone seconds.
BOTTOM_EXCLUSION = 0.15

# The top zone stops short of the frame's left and right edges, and the side
# zones stop short of its top, so that no zone runs into the frame border.
LATERAL_INSET = 0.03
VERTICAL_INSET = 0.05

# A zone opens only after it has been free for two consecutive samples and
# closes as soon as one sample is not free. The asymmetry is deliberately in
# the direction of not placing an image: a closed zone costs a placement
# opportunity, while a zone left open through a real intrusion puts a
# generated image on a hand.
OPEN_SAMPLES = 2
CLOSE_SAMPLES = 1


class Rect:
    __slots__ = ("x", "y", "w", "h")

    def __init__(self, x: float, y: float, w: float, h: float) -> None:
        self.x, self.y, self.w, self.h = x, y, w, h

    @property
    def area(self) -> float:
        return self.w * self.h

    def intersect(self, other: "Rect") -> "Rect | None":
        x = max(self.x, other.x)
        y = max(self.y, other.y)
        right = min(self.x + self.w, other.x + other.w)
        bottom = min(self.y + self.h, other.y + other.h)
        if right <= x or bottom <= y:
            return None
        return Rect(x, y, right - x, bottom - y)

    def to_dict(self) -> dict:
        return {"x": self.x, "y": self.y, "w": self.w, "h": self.h}


# Normalized units are anisotropic: the frames are 2160x3840, so w is a
# fraction of 2160 and h a fraction of 3840. The short edge is therefore
# compared in units of frame width, with h converted through the aspect ratio.
def short_edge(rect: Rect, aspect: float) -> float:
    """The rectangle's short edge as a fraction of the frame width.

    `aspect` is frame height over frame width.
    """
    return min(rect.w, rect.h * aspect)


def load_mask(path: str, threshold: float | None = None) -> np.ndarray:
    """A boolean person mask.

    `threshold` re-thresholds a stored confidence mask; without it the file is
    read as an already-binary mask. Session 1 wrote both per frame precisely
    so that trying a different threshold costs no inference.
    """
    if not Path(path).is_file():
        raise FileNotFoundError(f"mask not found: {path}")
    with Image.open(path) as handle:
        values = np.asarray(handle.convert("L"))
    if threshold is None:
        return values > 127
    return values > threshold * 255.0


def filter_components(mask: np.ndarray, floor: float = PERSON_COMPONENT_FLOOR) -> np.ndarray:
    """Drop connected components below `floor` as a fraction of the frame.

    The mask on disk is never modified; this filtering exists only so that a
    speck of matte noise at the frame edge cannot delete a zone.
    """
    from scipy import ndimage

    if not mask.any():
        return mask
    labels, count = ndimage.label(mask)
    if count <= 1:
        return mask
    sizes = np.asarray(ndimage.sum(mask, labels, range(1, count + 1)))
    keep = np.flatnonzero(sizes >= floor * mask.size) + 1
    return np.isin(labels, keep)


def component_report(mask: np.ndarray) -> list[dict]:
    """Every component with its area and box, for analysis and debug renders."""
    from scipy import ndimage

    labels, count = ndimage.label(mask)
    report = []
    for index in range(1, count + 1):
        component = labels == index
        area = int(component.sum())
        ys = np.flatnonzero(component.any(axis=1))
        xs = np.flatnonzero(component.any(axis=0))
        report.append(
            {
                "label": index,
                "areaPx": area,
                "areaFrameFraction": area / mask.size,
                "areaMaskFraction": area / int(mask.sum()) if mask.any() else 0.0,
                "box": {
                    "x0": int(xs[0]),
                    "y0": int(ys[0]),
                    "x1": int(xs[-1]),
                    "y1": int(ys[-1]),
                },
            }
        )
    report.sort(key=lambda c: c["areaPx"], reverse=True)
    return report


def free_rects(
    mask: np.ndarray,
    zone_margin: float = ZONE_MARGIN,
    min_zone_short_edge: float = MIN_ZONE_SHORT_EDGE,
    bottom_exclusion: float = BOTTOM_EXCLUSION,
    lateral_inset: float = LATERAL_INSET,
    vertical_inset: float = VERTICAL_INSET,
) -> dict[str, Rect | None]:
    """The free top, left and right rectangles for one filtered mask.

    A rectangle whose short edge is under `min_zone_short_edge` is discarded
    rather than emitted small: the images are square, so the short edge is the
    only dimension that bounds what fits.

    Occupancy is read per row and per column, never from a bounding box. Each
    zone reads occupancy only over the span it actually covers: a rectangle is
    free when nothing occupies it, and rejecting the left zone because an
    ankle occupies a column inside the excluded bottom band would refuse
    space that is genuinely free.
    """
    height, width = mask.shape
    side_top = vertical_inset
    # The frame height less the vertical insets, then clipped above the
    # bottom exclusion, which is the lower of the two by design.
    side_bottom = min(1.0 - vertical_inset, 1.0 - bottom_exclusion)

    rects: dict[str, Rect | None] = {"top": None, "left": None, "right": None}
    if side_bottom <= side_top:
        raise ValueError("bottom exclusion leaves the side zones no height")

    # Top: rows occupied anywhere across the zone's own width.
    x0 = int(round(lateral_inset * width))
    x1 = int(round((1.0 - lateral_inset) * width))
    band = mask[:, x0:x1]
    rows = np.flatnonzero(band.any(axis=1))
    top_limit = (rows[0] / height) - zone_margin if rows.size else 1.0
    if top_limit > 0:
        rects["top"] = Rect(lateral_inset, 0.0, 1.0 - 2.0 * lateral_inset, min(top_limit, 1.0))

    # Sides: columns occupied anywhere across the side zones' own height.
    y0 = int(round(side_top * height))
    y1 = int(round(side_bottom * height))
    strip = mask[y0:y1, :]
    cols = np.flatnonzero(strip.any(axis=0))
    side_height = side_bottom - side_top
    if cols.size:
        left_limit = (cols[0] / width) - zone_margin
        if left_limit > 0:
            rects["left"] = Rect(0.0, side_top, left_limit, side_height)
        right_start = ((cols[-1] + 1) / width) + zone_margin
        if right_start < 1.0:
            rects["right"] = Rect(right_start, side_top, 1.0 - right_start, side_height)
    else:
        # Nobody inside the side band at all: both sides are the full strip.
        rects["left"] = Rect(0.0, side_top, 0.5, side_height)
        rects["right"] = Rect(0.5, side_top, 0.5, side_height)

    aspect = height / width
    for kind, rect in rects.items():
        if rect is not None and short_edge(rect, aspect) < min_zone_short_edge:
            rects[kind] = None
    return rects


def hysteresis_windows(
    rects: list[Rect | None],
    times: list[float],
    open_samples: int = OPEN_SAMPLES,
    close_samples: int = CLOSE_SAMPLES,
) -> list[tuple[float, float, Rect]]:
    """Runs of free samples reduced to validity windows.

    A window opens once `open_samples` consecutive samples carry a rectangle,
    and it is credited from the first sample of that run rather than from the
    sample that satisfied the count. It closes after `close_samples`
    consecutive samples without one. The emitted rectangle is the
    intersection across the whole window, so it is free for every sample the
    window claims.
    """
    if len(rects) != len(times):
        raise ValueError(f"{len(rects)} rectangles against {len(times)} timestamps")

    windows: list[tuple[float, float, Rect]] = []
    run_start: int | None = None
    run_len = 0
    missing = 0
    opened = False

    def close(end_index: int) -> None:
        nonlocal run_start, opened
        if opened and run_start is not None:
            merged: Rect | None = None
            for rect in rects[run_start : end_index + 1]:
                if rect is None:
                    continue
                merged = rect if merged is None else merged.intersect(rect)
                if merged is None:
                    break
            if merged is not None:
                windows.append((times[run_start], times[end_index], merged))
        run_start = None
        opened = False

    last_present = -1
    for index, rect in enumerate(rects):
        if rect is not None:
            missing = 0
            if run_start is None:
                run_start = index
                run_len = 0
            run_len += 1
            last_present = index
            if run_len >= open_samples:
                opened = True
        else:
            missing += 1
            if missing >= close_samples:
                close(last_present)
                run_len = 0
    close(last_present)
    return windows


def compute_zones(
    frames: list[dict],
    threshold: float | None = None,
    component_floor: float = PERSON_COMPONENT_FLOOR,
    zone_margin: float = ZONE_MARGIN,
    min_zone_short_edge: float = MIN_ZONE_SHORT_EDGE,
    bottom_exclusion: float = BOTTOM_EXCLUSION,
    lateral_inset: float = LATERAL_INSET,
    vertical_inset: float = VERTICAL_INSET,
    open_samples: int = OPEN_SAMPLES,
    close_samples: int = CLOSE_SAMPLES,
) -> dict:
    """Zones and validity windows for one reel's ordered mask sequence."""
    if not frames:
        raise ValueError("compute_zones needs at least one frame")

    times = [float(frame["timeS"]) for frame in frames]
    per_kind: dict[str, list[Rect | None]] = {"top": [], "left": [], "right": []}
    per_frame: list[dict] = []
    shape: tuple[int, int] | None = None

    for frame, time_s in zip(frames, times):
        mask = filter_components(load_mask(frame["maskPath"], threshold), component_floor)
        if shape is None:
            shape = mask.shape
        rects = free_rects(
            mask,
            zone_margin,
            min_zone_short_edge,
            bottom_exclusion,
            lateral_inset,
            vertical_inset,
        )
        for kind, rect in rects.items():
            per_kind[kind].append(rect)
        per_frame.append(
            {
                "timeS": time_s,
                **{kind: (rect.to_dict() if rect else None) for kind, rect in rects.items()},
            }
        )

    zones = []
    for kind in ("top", "left", "right"):
        for ordinal, (start, end, rect) in enumerate(
            hysteresis_windows(per_kind[kind], times, open_samples, close_samples), start=1
        ):
            # One zone per window rather than one zone with several windows:
            # the emitted rectangle is that window's intersection, and two
            # windows do not in general share a rectangle to hang them on.
            zones.append(
                {
                    "id": f"z_{kind}_{ordinal}",
                    "kind": kind,
                    "rect": rect.to_dict(),
                    "valid": [[start, end]],
                    "manual": False,
                }
            )

    empty_samples = sum(
        1 for entry in per_frame if not any(entry[kind] for kind in ("top", "left", "right"))
    )
    height, width = shape if shape else (0, 0)
    return {
        "zones": zones,
        "perFrame": per_frame,
        "width": width,
        "height": height,
        "emptySamples": empty_samples,
    }
