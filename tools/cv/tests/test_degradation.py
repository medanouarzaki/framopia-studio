"""Proving the two silent metrics can fire, on a real cutout.

`alpha_edge_noise` and `hole_ratio` read exactly 0.00000 on all six corpus
images, and nothing in that distinguishes a correct zero from a metric that
cannot fire on real input. No real image has ever produced a `card` outcome
either, so that whole branch of the gate was untested outside synthetic
fixtures.

These tests take a real cutout off disk and degrade it deterministically —
a hole punched through the subject, specks scattered outside it, the alpha
dilated to simulate retained background — and assert each metric moves the
right way and crosses its own threshold. Real-image-derived, free, and it is
where the pipeline's first `card` outcome comes from.

Skipped when the corpus is absent, so a fresh clone can still run the suite.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from framopia_cv.gate import (
    MAX_ALPHA_EDGE_NOISE,
    MAX_EDGE_HALO,
    MAX_HOLE_RATIO,
    evaluate,
)
from framopia_cv.metrics import SOLID, compute_metrics
from scipy import ndimage

CUTOUT = (
    Path(__file__).resolve().parents[3]
    / "benchmarks"
    / "results"
    / "latest-cutouts"
    / "gemini-3-pro-image-1.cutout.png"
)

pytestmark = pytest.mark.skipif(
    not CUTOUT.exists(), reason=f"corpus cutout absent: {CUTOUT}"
)


@pytest.fixture(scope="module")
def alpha() -> np.ndarray:
    return np.asarray(Image.open(CUTOUT).getchannel("A"), dtype=np.float64) / 255.0


def punch_hole(a: np.ndarray, fraction: float = 0.05) -> np.ndarray:
    """Remove a square of subject from the middle of its bounding box.

    Placed at the centroid of the solid mask so it lands on the bottle body
    and is genuinely enclosed, which is what makes it a hole rather than a
    notch.
    """
    out = a.copy()
    solid = a >= SOLID
    ys, xs = np.nonzero(solid)
    cy, cx = int(ys.mean()), int(xs.mean())
    side = int((solid.sum() * fraction) ** 0.5)
    half = side // 2
    out[cy - half : cy + half, cx - half : cx + half] = 0.0
    return out


def scatter_specks(a: np.ndarray, count: int = 400, size: int = 6) -> np.ndarray:
    """Add opaque blocks in a corner well away from the subject."""
    out = a.copy()
    step = size * 2
    for i in range(count):
        y = 10 + (i % 20) * step
        x = 10 + (i // 20) * step
        out[y : y + size, x : x + size] = 1.0
    return out


def dilate_alpha(a: np.ndarray, px: int = 3, strength: float = 0.6) -> np.ndarray:
    """Wrap the subject in partial alpha, as a matte retaining background."""
    out = a.copy()
    solid = a >= SOLID
    grown = ndimage.binary_dilation(solid, iterations=px + 3)
    out[grown & ~solid] = np.maximum(out[grown & ~solid], strength)
    return out


class TestTheCorpusCutoutIsClean:
    def test_it_scores_zero_on_both_silent_metrics(self, alpha):
        m = compute_metrics(alpha)
        assert m.alpha_edge_noise == 0.0
        assert m.hole_ratio == 0.0
        assert evaluate(m).presentation == "cutout"


class TestHoleRatioFires:
    def test_a_punched_hole_moves_it_up_and_over_the_threshold(self, alpha):
        before = compute_metrics(alpha).hole_ratio
        after = compute_metrics(punch_hole(alpha)).hole_ratio
        assert before == 0.0
        assert after > before
        assert after > MAX_HOLE_RATIO

    def test_the_gate_returns_card(self, alpha):
        result = evaluate(compute_metrics(punch_hole(alpha)))
        assert result.presentation == "card"
        assert any("hole_ratio" in f for f in result.failures)


class TestAlphaEdgeNoiseFires:
    def test_scattered_specks_move_it_up_and_over_the_threshold(self, alpha):
        before = compute_metrics(alpha).alpha_edge_noise
        after = compute_metrics(scatter_specks(alpha)).alpha_edge_noise
        assert before == 0.0
        assert after > before
        assert after > MAX_ALPHA_EDGE_NOISE

    def test_the_gate_returns_card(self, alpha):
        result = evaluate(compute_metrics(scatter_specks(alpha)))
        assert result.presentation == "card"
        assert any("alpha_edge_noise" in f for f in result.failures)


class TestEdgeHaloFires:
    def test_a_dilated_matte_crosses_the_threshold(self, alpha):
        before = compute_metrics(alpha).edge_halo
        after = compute_metrics(dilate_alpha(alpha)).edge_halo
        assert after > before
        assert after > MAX_EDGE_HALO

    def test_the_gate_returns_card(self, alpha):
        result = evaluate(compute_metrics(dilate_alpha(alpha)))
        assert result.presentation == "card"
        assert any("edge_halo" in f for f in result.failures)


class TestDegradationsAreIndependent:
    """Each degradation must move its own metric and leave the others alone,
    or a `card` outcome could not be attributed to a cause."""

    def test_a_hole_does_not_create_speckle(self, alpha):
        assert compute_metrics(punch_hole(alpha)).alpha_edge_noise == 0.0

    def test_specks_do_not_create_holes(self, alpha):
        assert compute_metrics(scatter_specks(alpha)).hole_ratio == 0.0
