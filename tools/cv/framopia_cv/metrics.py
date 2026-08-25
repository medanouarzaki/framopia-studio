"""Cutout quality metrics, ARCHITECTURE §5.4.

All four are computed on the **alpha channel alone**, as a float array in
[0, 1] with shape (H, W). None of them looks at colour: a cutout is judged on
the shape of its matte, and a metric that depended on the subject's colour
would score a dark subject differently from a light one for no reason. That
matters here — every image in the Block 4 corpus is a dark subject on a dark
ground.

Each metric returns a value where **higher is worse**, except
`foreground_area`, which is a fraction and is judged against a band. A metric
nobody can reproduce is not evidence, so each one states exactly what it
counts.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict

import numpy as np
from scipy import ndimage

# Alpha at or above this is "solid subject"; at or below its complement is
# "solid background". Between them is the transition band a matte is allowed
# to have at an edge. 0.1/0.9 is the usual convention for alpha thresholding
# and nothing here is tuned to the corpus.
SOLID = 0.9
CLEAR = 0.1


@dataclass(frozen=True)
class CutoutMetrics:
    alpha_edge_noise: float
    hole_ratio: float
    foreground_area: float
    edge_halo: float

    def to_dict(self) -> dict[str, float]:
        return asdict(self)


def _as_alpha(alpha: np.ndarray) -> np.ndarray:
    a = np.asarray(alpha, dtype=np.float64)
    if a.ndim != 2:
        raise ValueError(f"alpha must be 2-D, got shape {a.shape}")
    if a.max(initial=0.0) > 1.0:
        a = a / 255.0
    return np.clip(a, 0.0, 1.0)


def alpha_edge_noise(alpha: np.ndarray) -> float:
    """Speckle in the matte: isolated components that are not the subject.

    Counts the pixels that are solid foreground but do **not** belong to the
    largest connected foreground component, as a fraction of all solid
    foreground pixels. A clean cutout is one blob and scores 0; a matte that
    has scattered fragments of background across the frame scores the
    fraction of itself that is scattered.

    This is deliberately not a gradient or variance measure. Those confuse a
    legitimately soft edge — hair, motion blur — with noise, and the soft-edge
    case is one we want to keep.
    """
    a = _as_alpha(alpha)
    solid = a >= SOLID
    total = int(solid.sum())
    if total == 0:
        return 0.0
    labels, count = ndimage.label(solid)
    if count <= 1:
        return 0.0
    sizes = ndimage.sum_labels(solid, labels, index=np.arange(1, count + 1))
    return float((total - sizes.max()) / total)


def hole_ratio(alpha: np.ndarray) -> float:
    """Background punched through the subject.

    Fills the holes in the solid-foreground mask and reports the filled area
    as a fraction of the filled subject. A hole is background enclosed by
    subject on all sides — the failure where a matte eats through a bottle or
    drops the middle of a face. An open notch at the frame edge is not a hole
    and is not counted.
    """
    a = _as_alpha(alpha)
    solid = a >= SOLID
    if not solid.any():
        return 0.0
    filled = ndimage.binary_fill_holes(solid)
    filled_area = int(filled.sum())
    if filled_area == 0:
        return 0.0
    return float((filled_area - int(solid.sum())) / filled_area)


def foreground_area(alpha: np.ndarray) -> float:
    """Fraction of the frame the subject occupies.

    Judged against a band rather than a threshold, because both ends are
    failures: near 0 means the remover found nothing and the cutout is empty,
    near 1 means it kept the whole frame and cut nothing out. The second is
    the one to watch on this corpus — a dark subject on a dark ground is
    exactly the case where a remover returns the input unchanged.
    """
    a = _as_alpha(alpha)
    return float((a >= SOLID).sum() / a.size)


# Pixels of transition a genuine soft edge is allowed before the halo
# measurement starts. Hair, motion blur and a feathered matte all ramp from
# opaque to clear across a couple of pixels; a halo is background that
# persists past that. Measuring from the solid edge outward with no skip
# cannot tell the two apart — both are partial alpha just outside the solid
# mask — so the first SOFT_EDGE_SKIP_PX are excluded by construction.
SOFT_EDGE_SKIP_PX = 2
HALO_BAND_PX = 3


def edge_halo(
    alpha: np.ndarray,
    skip_px: int = SOFT_EDGE_SKIP_PX,
    band_px: int = HALO_BAND_PX,
) -> float:
    """Partial alpha that persists beyond the subject's soft edge.

    Takes the ring between `skip_px` and `skip_px + band_px` pixels **outside**
    the solid subject and reports the mean alpha there. A clean matte, and a
    matte with a legitimately soft edge, have both decayed to zero by then and
    score 0; a matte carrying a rim of the old background scores the strength
    of that rim where it should already be gone.

    Measured outside the solid mask only. Partial alpha further in is the
    subject's own boundary and is wanted.
    """
    a = _as_alpha(alpha)
    solid = a >= SOLID
    if not solid.any() or solid.all():
        return 0.0
    inner = ndimage.binary_dilation(solid, iterations=skip_px) if skip_px > 0 else solid
    outer = ndimage.binary_dilation(inner, iterations=band_px)
    ring = outer & ~inner
    if not ring.any():
        return 0.0
    return float(a[ring].mean())


def compute_metrics(alpha: np.ndarray) -> CutoutMetrics:
    return CutoutMetrics(
        alpha_edge_noise=alpha_edge_noise(alpha),
        hole_ratio=hole_ratio(alpha),
        foreground_area=foreground_area(alpha),
        edge_halo=edge_halo(alpha),
    )
