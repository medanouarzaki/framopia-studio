"""Metrics on synthetic mattes where the right answer is known by construction."""

import numpy as np
import pytest

from framopia_cv.gate import MAX_EDGE_HALO, evaluate
from framopia_cv.metrics import (
    CutoutMetrics,
    alpha_edge_noise,
    compute_metrics,
    edge_halo,
    foreground_area,
    hole_ratio,
)

SIZE = 200


def clean_cutout() -> np.ndarray:
    """One solid square, nothing else. Every "worse is higher" metric is 0."""
    a = np.zeros((SIZE, SIZE))
    a[50:150, 50:150] = 1.0
    return a


def holed_cutout(hole: int = 20) -> np.ndarray:
    """The same square with background punched through the middle."""
    a = clean_cutout()
    a[90 : 90 + hole, 90 : 90 + hole] = 0.0
    return a


def speckled_cutout(specks: int = 40) -> np.ndarray:
    """The same square plus isolated fragments away from it."""
    a = clean_cutout()
    for i in range(specks):
        a[5 + (i % 20) * 2, 5 + (i // 20) * 2] = 1.0
    return a


def haloed_cutout(strength: float = 0.5, band: int = 8) -> np.ndarray:
    """The same square wrapped in a wide ring of partial alpha.

    Wide on purpose: a halo is background that persists past the couple of
    pixels a genuine soft edge takes to decay.
    """
    a = clean_cutout()
    a[50 - band : 150 + band, 50 - band : 150 + band] = np.maximum(
        a[50 - band : 150 + band, 50 - band : 150 + band], strength
    )
    a[50:150, 50:150] = 1.0
    return a


def soft_edged_cutout(band: int = 2) -> np.ndarray:
    """A square whose matte ramps to clear over `band` pixels.

    This is a good cutout, not a bad one, and it must not score as halo.
    """
    a = clean_cutout()
    for step in range(1, band + 1):
        value = 1.0 - step / (band + 1)
        lo, hi = 50 - step, 150 + step
        a[lo:hi, lo:hi] = np.maximum(a[lo:hi, lo:hi], value)
    a[50:150, 50:150] = 1.0
    return a


class TestAlphaEdgeNoise:
    def test_clean_cutout_is_zero(self):
        assert alpha_edge_noise(clean_cutout()) == 0.0

    def test_counts_only_pixels_off_the_main_blob(self):
        specks = 40
        a = speckled_cutout(specks)
        expected = specks / (100 * 100 + specks)
        assert alpha_edge_noise(a) == pytest.approx(expected)

    def test_empty_matte_is_zero_not_undefined(self):
        assert alpha_edge_noise(np.zeros((SIZE, SIZE))) == 0.0

    def test_a_soft_edge_is_not_noise(self):
        # A legitimately soft boundary must not read as speckle; that is why
        # this is a connectivity measure and not a gradient one.
        assert alpha_edge_noise(haloed_cutout()) == 0.0


class TestHoleRatio:
    def test_clean_cutout_is_zero(self):
        assert hole_ratio(clean_cutout()) == 0.0

    def test_reports_enclosed_background_as_a_fraction_of_the_filled_subject(self):
        hole = 20
        a = holed_cutout(hole)
        assert hole_ratio(a) == pytest.approx((hole * hole) / (100 * 100))

    def test_a_notch_at_the_subject_edge_is_not_a_hole(self):
        a = clean_cutout()
        a[50:70, 50:70] = 0.0  # bites the corner, not enclosed
        assert hole_ratio(a) == 0.0

    def test_empty_matte_is_zero(self):
        assert hole_ratio(np.zeros((SIZE, SIZE))) == 0.0


class TestForegroundArea:
    def test_is_the_fraction_of_the_frame(self):
        assert foreground_area(clean_cutout()) == pytest.approx((100 * 100) / (SIZE * SIZE))

    def test_empty_matte_is_zero(self):
        assert foreground_area(np.zeros((SIZE, SIZE))) == 0.0

    def test_near_total_foreground_is_near_one(self):
        # The failure this corpus is most exposed to: a dark subject on a dark
        # ground where the remover keeps the whole frame.
        assert foreground_area(np.ones((SIZE, SIZE))) == 1.0


class TestEdgeHalo:
    def test_clean_cutout_is_zero(self):
        assert edge_halo(clean_cutout()) == 0.0

    def test_reports_mean_alpha_just_outside_the_subject(self):
        assert edge_halo(haloed_cutout(strength=0.5)) == pytest.approx(0.5)

    def test_a_genuine_soft_edge_passes_the_gate(self):
        # Hair and motion blur ramp to clear over a pixel or two. If that
        # scored as halo, every good matte with a soft boundary would be sent
        # to card. Asserted against the gate rather than against zero: the
        # metric is allowed a trace, it is not allowed to fail a good matte.
        assert edge_halo(soft_edged_cutout(1)) == 0.0
        assert edge_halo(soft_edged_cutout(2)) < MAX_EDGE_HALO
        assert evaluate(compute_metrics(soft_edged_cutout(2))).presentation == "cutout"

    def test_a_halo_beyond_the_soft_edge_still_scores(self):
        assert edge_halo(haloed_cutout(strength=0.5)) > 0.4

    def test_a_full_frame_matte_has_no_outside(self):
        assert edge_halo(np.ones((SIZE, SIZE))) == 0.0


class TestAlphaScaling:
    def test_accepts_0_255_and_0_1_alike(self):
        assert compute_metrics(clean_cutout()).to_dict() == compute_metrics(
            clean_cutout() * 255
        ).to_dict()

    def test_rejects_a_non_2d_array(self):
        with pytest.raises(ValueError):
            alpha_edge_noise(np.zeros((10, 10, 3)))


class TestGate:
    def test_a_clean_cutout_passes(self):
        result = evaluate(compute_metrics(clean_cutout()))
        assert result.passed
        assert result.presentation == "cutout"
        assert result.failures == []

    def test_a_holed_cutout_falls_back_to_card(self):
        result = evaluate(compute_metrics(holed_cutout()))
        assert not result.passed
        assert result.presentation == "card"
        assert any("hole_ratio" in f for f in result.failures)

    def test_a_haloed_cutout_falls_back_to_card(self):
        result = evaluate(compute_metrics(haloed_cutout(strength=0.5)))
        assert result.presentation == "card"
        assert any("edge_halo" in f for f in result.failures)

    def test_a_near_total_foreground_falls_back_to_card(self):
        result = evaluate(CutoutMetrics(0.0, 0.0, 0.99, 0.0))
        assert result.presentation == "card"
        assert any("foreground_area" in f for f in result.failures)

    def test_an_empty_matte_falls_back_to_card(self):
        result = evaluate(compute_metrics(np.zeros((SIZE, SIZE))))
        assert result.presentation == "card"
        assert any("foreground_area" in f for f in result.failures)

    def test_every_failing_metric_is_named(self):
        result = evaluate(CutoutMetrics(0.5, 0.5, 0.99, 0.5))
        assert len(result.failures) == 4


class TestEdgeHaloAgainstTheOriginal:
    """The distinction the metric exists to make.

    Without the original, alpha outside a subject is alpha outside a subject
    and the metric cannot tell a rim the model drew from a rim the remover
    left. These build both cases with the same alpha and differing sources.
    """

    def source(self, brightness: float) -> np.ndarray:
        """An HxWx3 image whose halo band carries `brightness`."""
        rgb = np.zeros((SIZE, SIZE, 3))
        rgb[:] = 0.02  # the mode grounds subjects against #1A0000
        band = 10
        rgb[50 - band : 150 + band, 50 - band : 150 + band] = brightness
        rgb[50:150, 50:150] = 0.6  # the subject itself
        return rgb

    def test_a_rendered_rim_is_not_halo(self):
        from framopia_cv.metrics import luminance_of

        alpha = haloed_cutout(strength=0.5)
        lit = luminance_of(self.source(0.9))
        assert edge_halo(alpha, lit) == pytest.approx(0.0)
        assert evaluate(compute_metrics(alpha, lit)).presentation == "cutout"

    def test_retained_background_still_counts(self):
        from framopia_cv.metrics import luminance_of

        alpha = haloed_cutout(strength=0.5)
        dark = luminance_of(self.source(0.02))
        assert edge_halo(alpha, dark) > MAX_EDGE_HALO
        assert evaluate(compute_metrics(alpha, dark)).presentation == "card"

    def test_a_mixture_counts_only_the_dark_half(self):
        from framopia_cv.metrics import luminance_of

        alpha = haloed_cutout(strength=0.5)
        rgb = self.source(0.9)
        rgb[:, : SIZE // 2] = 0.02  # left half dark in the source
        mixed = edge_halo(alpha, luminance_of(rgb))
        assert 0.0 < mixed <= 0.5

    # Omitting the source keeps the old behaviour, which is what every
    # synthetic test above exercises: they build alpha with no image behind it.
    def test_without_a_source_it_measures_alpha_alone(self):
        alpha = haloed_cutout(strength=0.5)
        assert edge_halo(alpha) == pytest.approx(0.5, abs=0.05)

    def test_rejects_a_source_of_the_wrong_shape(self):
        with pytest.raises(ValueError):
            edge_halo(clean_cutout(), np.zeros((10, 10)))


class TestLuminance:
    def test_matches_the_mode_palette(self):
        from framopia_cv.metrics import luminance_of

        assert luminance_of(np.array([[[26, 0, 0]]]))[0, 0] == pytest.approx(0.0217, abs=1e-3)
        assert luminance_of(np.array([[[248, 246, 242]]]))[0, 0] == pytest.approx(0.965, abs=1e-3)

    def test_accepts_0_1_and_0_255_alike(self):
        from framopia_cv.metrics import luminance_of

        assert luminance_of(np.array([[[1.0, 1.0, 1.0]]]))[0, 0] == pytest.approx(1.0)
        assert luminance_of(np.array([[[255, 255, 255]]]))[0, 0] == pytest.approx(1.0)

    def test_rejects_a_non_image_array(self):
        from framopia_cv.metrics import luminance_of

        with pytest.raises(ValueError):
            luminance_of(np.zeros((10, 10)))
