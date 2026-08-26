"""Maximal free rectangles anywhere in the frame.

The three fixed rectangles (top, left, right) are structurally blind to the
L-shaped region beside the head and above the shoulders: it sits below the top
rectangle's cut and inside the width of the arms, so it belongs to no kind.
Measured on the median frame, the three capture 76-82% of the free area on four
reels and 58% on vitasilk.

This finds rectangles from the occupancy grid instead, and the kind becomes a
label derived from where a rectangle sits rather than the thing that defines it.
"""

from __future__ import annotations

import numpy as np

# The occupancy grid is coarsened by this factor before the search. The search
# is a per-row stack scan that does not vectorise, and 960x540 per frame over
# five reels is minutes rather than seconds. At 4 a cell is 16 source pixels,
# well under ZONE_MARGIN's 43. CHOSEN, NOT MEASURED.
GRID_DOWNSAMPLE = 4

# How many rectangles to emit per frame. Enough for a top, two sides and the
# region beside the head, and few enough that the per-frame result stays
# readable. CHOSEN, NOT MEASURED.
MAX_ZONES_PER_FRAME = 4

# Two rectangles in consecutive frames are the same zone when they overlap this
# much, as intersection over union. A NEW DECISION this session: the fixed
# kinds matched implicitly by being the same kind, and rectangles found by
# position have no such identity. CHOSEN, NOT MEASURED.
MATCH_MIN_IOU = 0.5


def coarsen(mask: np.ndarray, factor: int = GRID_DOWNSAMPLE) -> np.ndarray:
    """Max-pool the person mask.

    A coarse cell counts as occupied when any of its pixels is, so coarsening
    can only shrink a free rectangle. Claiming occupied space as free is the
    error that puts an image on a face.
    """
    rows, cols = mask.shape
    r, c = rows // factor, cols // factor
    trimmed = mask[: r * factor, : c * factor]
    return trimmed.reshape(r, factor, c, factor).any(axis=(1, 3))


def _largest_by_square(free: np.ndarray) -> tuple[int, int, int, int] | None:
    """The free rectangle with the largest inscribable square.

    Largest-rectangle-under-histogram with a monotonic stack, run per row, with
    the objective changed from area to `min(width, height)`. The grid is
    isotropic — 540x960 for a 2160x3840 frame is a quarter on both axes — so
    the smaller side in cells is the inscribable square, and area would reward
    a long thin strip that fits no square image.

    Returns (y0, x0, y1, x1) with exclusive ends, or None when nothing is free.
    """
    rows, cols = free.shape
    heights = [0] * (cols + 1)
    best = None
    best_score = 0

    for y in range(rows):
        row = free[y]
        for x in range(cols):
            heights[x] = heights[x] + 1 if row[x] else 0

        stack: list[int] = []
        for x in range(cols + 1):
            while stack and heights[stack[-1]] >= heights[x]:
                height = heights[stack.pop()]
                left = stack[-1] + 1 if stack else 0
                width = x - left
                if height == 0 or width == 0:
                    continue
                score = min(width, height)
                # Ties broken by area, then by position, so the result is a
                # total order and does not depend on scan artefacts.
                candidate = (score, width * height, -(y - height + 1), -left)
                if best is None or candidate > best_score:
                    best_score = candidate
                    best = (y - height + 1, left, y + 1, x)
            stack.append(x)

    return best


def free_rectangles(
    mask: np.ndarray,
    limit: int = MAX_ZONES_PER_FRAME,
    factor: int = GRID_DOWNSAMPLE,
) -> list[dict]:
    """Up to `limit` maximal free rectangles, normalized 0-1, largest square first.

    Greedy extraction: take the best rectangle, mark it occupied, repeat. The
    alternative — enumerating every maximal rectangle — returns quadratically
    many overlapping candidates that then need their own selection rule, and
    greedy extraction is deterministic and gives rectangles that do not overlap
    each other, which is what a placement solver can use directly.
    """
    grid = coarsen(mask, factor)
    free = ~grid
    rows, cols = grid.shape

    out: list[dict] = []
    for _ in range(limit):
        found = _largest_by_square(free)
        if found is None:
            break
        y0, x0, y1, x1 = found
        if min(x1 - x0, y1 - y0) <= 0:
            break
        out.append(
            {
                "x": x0 / cols,
                "y": y0 / rows,
                "w": (x1 - x0) / cols,
                "h": (y1 - y0) / rows,
                "cells": (int(x1 - x0), int(y1 - y0)),
            }
        )
        free[y0:y1, x0:x1] = False
    return out


def label_kind(rect: dict, mask: np.ndarray) -> str | None:
    """Where a rectangle sits relative to the person, in §3's existing enum.

    `top` when the rectangle is entirely above the person's topmost occupied
    row. `left` and `right` when it is entirely to one side of the columns the
    person occupies **within the rectangle's own rows** — which is what puts the
    region beside the head on the correct side instead of nowhere.

    Returns None when a rectangle fits none of them. ARCHITECTURE §3's enum is
    `top|left|right` and this session does not invent a fourth value.
    """
    rows, cols = mask.shape
    occupied_rows = np.flatnonzero(mask.any(axis=1))
    if occupied_rows.size == 0:
        return "top"

    y0 = int(round(rect["y"] * rows))
    y1 = int(round((rect["y"] + rect["h"]) * rows))
    x0 = int(round(rect["x"] * cols))
    x1 = int(round((rect["x"] + rect["w"]) * cols))

    if y1 <= int(occupied_rows[0]):
        return "top"

    band = mask[max(0, y0) : max(y0 + 1, y1), :]
    band_cols = np.flatnonzero(band.any(axis=0))
    if band_cols.size == 0:
        # Nobody in these rows at all: side is decided against the person's
        # overall horizontal centre.
        all_cols = np.flatnonzero(mask.any(axis=0))
        centre = (all_cols[0] + all_cols[-1]) / 2 if all_cols.size else cols / 2
        return "left" if (x0 + x1) / 2 < centre else "right"

    if x1 <= int(band_cols[0]):
        return "left"
    if x0 >= int(band_cols[-1]) + 1:
        return "right"
    return None


def iou(a: dict, b: dict) -> float:
    ax1, ay1 = a["x"] + a["w"], a["y"] + a["h"]
    bx1, by1 = b["x"] + b["w"], b["y"] + b["h"]
    ix = max(0.0, min(ax1, bx1) - max(a["x"], b["x"]))
    iy = max(0.0, min(ay1, by1) - max(a["y"], b["y"]))
    overlap = ix * iy
    union = a["w"] * a["h"] + b["w"] * b["h"] - overlap
    return overlap / union if union > 0 else 0.0
