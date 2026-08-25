import type { CutoutMetricsJson, SidecarGate } from './sidecar.js';

/**
 * The §5.4 thresholds, mirrored from `tools/cv/framopia_cv/gate.py`.
 *
 * Duplicated deliberately and narrowly: the gate decision is made in Python
 * and this side never re-decides it — `cutoutQuality` is a scalar for
 * ordering and display, and a drift between the two would move a number a
 * human reads, not a `cutout`/`card` outcome. A test pins the two together so
 * the drift is caught anyway.
 */
export const THRESHOLDS = {
  alpha_edge_noise: 0.02,
  hole_ratio: 0.01,
  edge_halo: 0.1,
} as const;

export const FOREGROUND_AREA_BAND = { min: 0.05, max: 0.92 } as const;

/**
 * A single number for "how comfortably did this matte pass", in [0, 1].
 *
 * The **minimum** headroom across the metrics, not the mean: a matte with one
 * bad metric and three perfect ones is a bad matte, and averaging would hide
 * exactly the candidate an editor needs to see. 1.0 is a matte at zero on
 * every bound; 0 is a matte sitting on one, or past it.
 *
 * Not a gate. `gate.passed` decides; this orders.
 */
export function cutoutQuality(metrics: CutoutMetricsJson): number {
  const headrooms = [
    1 - metrics.alpha_edge_noise / THRESHOLDS.alpha_edge_noise,
    1 - metrics.hole_ratio / THRESHOLDS.hole_ratio,
    1 - metrics.edge_halo / THRESHOLDS.edge_halo,
    areaHeadroom(metrics.foreground_area),
  ];
  return clamp01(Math.min(...headrooms));
}

/**
 * Foreground area is judged against a band, so its headroom is the distance
 * to the nearer edge over the half-width — 1 at the middle of the band, 0 at
 * either end.
 */
function areaHeadroom(area: number): number {
  const { min, max } = FOREGROUND_AREA_BAND;
  const half = (max - min) / 2;
  const centre = min + half;
  return 1 - Math.abs(area - centre) / half;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * The slot's presentation, given the gate's verdict on every candidate.
 *
 * Null unless the candidates agree. `presentation` follows whichever
 * candidate the editor picks, and nobody has picked — session 1 made the
 * field nullable precisely so a guess could not read as a decision. When all
 * candidates pass, `cutout` is true whichever is chosen; when all fail,
 * `card` is forced. A split leaves it null and the per-candidate `gate`
 * carries the detail.
 */
export function slotPresentation(gates: SidecarGate[]): 'cutout' | 'card' | null {
  if (gates.length === 0) return null;
  if (gates.every((g) => g.passed)) return 'cutout';
  if (gates.every((g) => !g.passed)) return 'card';
  return null;
}
