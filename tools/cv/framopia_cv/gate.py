"""The cutout quality gate, ARCHITECTURE §5.4.

Below threshold the slot falls back to `presentation: "card"`; at or above it
the cutout is used. The editor can override either way — that is a later
block's UI, but the plan field already carries it.

**These thresholds are provisional and were declared before the Block 4
corpus was measured.** Six images from one prompt on one slot is not a tuning
set; thresholds fitted to it would be wrong on every other reel. They are set
from what each metric means, not from what these six images happen to score,
and they are expected to move once there is a real spread of subjects.
"""

from __future__ import annotations

from dataclasses import dataclass

from .metrics import CutoutMetrics

# Speckle. A matte that is 2% scattered fragments is visibly dirty against a
# flat card; below that the fragments are sub-pixel dust that compositing
# hides. Provisional.
MAX_ALPHA_EDGE_NOISE = 0.02

# Holes. Anything above 1% of the subject punched through is a hole a viewer
# sees — a gap in a bottle, a missing patch of face. Small enclosed gaps at
# 1% or under are usually genuine (the space inside a handle). Provisional.
MAX_HOLE_RATIO = 0.01

# Area band. Below 5% the remover found essentially nothing and the cutout is
# empty. Above 92% it kept almost the whole frame, which is the failure mode
# this corpus is most exposed to: a dark subject on a dark ground, where a
# remover can return the input unchanged and call it a subject. Provisional,
# and the upper bound is the one most likely to be wrong.
MIN_FOREGROUND_AREA = 0.05
MAX_FOREGROUND_AREA = 0.92

# Halo. Mean alpha in the 3px ring outside the subject. A clean matte falls to
# zero there; 0.10 allows a soft edge without allowing a rim of old
# background. Provisional.
MAX_EDGE_HALO = 0.10


@dataclass(frozen=True)
class GateResult:
    presentation: str
    passed: bool
    failures: list[str]

    def to_dict(self) -> dict[str, object]:
        return {
            "presentation": self.presentation,
            "passed": self.passed,
            "failures": list(self.failures),
        }


def evaluate(metrics: CutoutMetrics) -> GateResult:
    """Every failing metric is named, not just the first.

    An editor deciding whether to override needs to know the cutout failed on
    holes rather than on area; "failed" alone is not actionable.
    """
    failures: list[str] = []

    if metrics.alpha_edge_noise > MAX_ALPHA_EDGE_NOISE:
        failures.append(
            f"alpha_edge_noise {metrics.alpha_edge_noise:.4f} > {MAX_ALPHA_EDGE_NOISE}"
        )
    if metrics.hole_ratio > MAX_HOLE_RATIO:
        failures.append(f"hole_ratio {metrics.hole_ratio:.4f} > {MAX_HOLE_RATIO}")
    if metrics.foreground_area < MIN_FOREGROUND_AREA:
        failures.append(
            f"foreground_area {metrics.foreground_area:.4f} < {MIN_FOREGROUND_AREA}"
        )
    if metrics.foreground_area > MAX_FOREGROUND_AREA:
        failures.append(
            f"foreground_area {metrics.foreground_area:.4f} > {MAX_FOREGROUND_AREA}"
        )
    if metrics.edge_halo > MAX_EDGE_HALO:
        failures.append(f"edge_halo {metrics.edge_halo:.4f} > {MAX_EDGE_HALO}")

    passed = not failures
    return GateResult(
        presentation="cutout" if passed else "card",
        passed=passed,
        failures=failures,
    )
