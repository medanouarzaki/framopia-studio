import { IMPACT_THRESHOLD } from './impact-frame.js';
import type { AuditComp, AuditEase, AuditKeyframe } from './templates.js';

/**
 * When an animated property first reaches `IMPACT_THRESHOLD` of its final
 * value, computed from the **interpolated curve** rather than from where the
 * keyframes sit.
 *
 * The distinction is the whole point. `kw_slam`'s two Position keys are 12
 * frames apart, so the settle ends at 12 — but the easing front-loads the
 * motion and the word arrives long before that. Reading the last key put every
 * sound 8 frames late.
 *
 * **After Effects' convention**, which this implements: between two keys
 * spanning `d` seconds and a value delta `Δ`, the timing is a cubic bezier in
 * (time, value) space whose control points come from the temporal ease —
 * `influence` is the fraction of `d` the handle spans horizontally, and `speed`
 * is the value rate at the key, so the handle's vertical extent is
 * `speed × (influence/100 × d)`:
 *
 *     P0 = (0, 0)
 *     P1 = (i_out·d,        s_out · i_out·d)
 *     P2 = (d − i_in·d,  Δ − s_in  · i_in·d)
 *     P3 = (d, Δ)
 *
 * That matches AE because influence and speed are exactly how its graph editor
 * parameterises a handle: influence in percent along the segment, speed in
 * value-units per second. On these templates it checks out — every property's
 * out-handle has `speed × influence × d` equal to the full delta, which is what
 * a handle drawn to the top of the graph means.
 *
 * A spatial property such as Position reports **one** ease entry for all three
 * dimensions, because AE eases along the path; a scalar reports one, and a
 * multi-dimensional non-spatial property reports one per dimension. The value
 * axis is therefore the magnitude of the change, and that is what is thresholded.
 */
export interface Crossing {
  comp: string;
  property: string;
  /** Where the value first reaches the threshold, in seconds from the start. */
  crossingS: number | null;
  crossingFrames: number | null;
  /** The last keyframe, for comparison: the settle. */
  lastKeyS: number;
  lastKeyFrames: number;
  /** What the same two keys would give under linear interpolation. */
  linearFrames: number;
  unreadable: string | null;
}

/** Properties whose motion is the entrance. Effects are excluded deliberately:
 * a blur clearing is a legibility ramp, not the arrival. */
const ENTRANCE_PROPERTIES = ['Transform/Position', 'Transform/Scale', 'Transform/Opacity'];

/** The distance between two key values, however many dimensions they carry. */
function delta(from: unknown, to: unknown): number | null {
  if (typeof from === 'number' && typeof to === 'number') return to - from;
  if (Array.isArray(from) && Array.isArray(to) && from.length === to.length) {
    let sum = 0;
    for (let i = 0; i < from.length; i += 1) {
      const a = from[i];
      const b = to[i];
      if (typeof a !== 'number' || typeof b !== 'number') return null;
      sum += (b - a) * (b - a);
    }
    return Math.sqrt(sum);
  }
  return null;
}

function firstEase(ease: AuditEase[] | null | undefined): AuditEase | null {
  if (ease === null || ease === undefined || ease.length === 0) return null;
  return ease[0] ?? null;
}

function cubic(p0: number, p1: number, p2: number, p3: number, u: number): number {
  const v = 1 - u;
  return v * v * v * p0 + 3 * v * v * u * p1 + 3 * v * u * u * p2 + u * u * u * p3;
}

/**
 * The time at which the value bezier first reaches `target` of its delta.
 *
 * Solved by bisection on the curve parameter rather than algebraically: the
 * value is monotonic on these curves, the parameter is not time, and 10^-7 of a
 * segment is far below a frame.
 */
export function crossingTime(options: {
  durationS: number;
  deltaValue: number;
  outEase: AuditEase | null;
  inEase: AuditEase | null;
  threshold: number;
}): number | null {
  const { durationS, deltaValue, outEase, inEase, threshold } = options;
  if (outEase === null || inEase === null) return null;
  const iOut = outEase.influence;
  const sOut = outEase.speed;
  const iIn = inEase.influence;
  const sIn = inEase.speed;
  if (iOut === null || sOut === null || iIn === null || sIn === null) return null;
  if (deltaValue === 0) return null;

  const outSpan = (iOut / 100) * durationS;
  const inSpan = (iIn / 100) * durationS;

  // Value axis normalised to the delta, so the threshold is a fraction of it.
  const t0 = 0;
  const t1 = outSpan;
  const t2 = durationS - inSpan;
  const t3 = durationS;
  const v0 = 0;
  const v1 = (sOut * outSpan) / deltaValue;
  const v2 = 1 - (sIn * inSpan) / deltaValue;
  const v3 = 1;

  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 80; i += 1) {
    const mid = (lo + hi) / 2;
    if (cubic(v0, v1, v2, v3, mid) < threshold) lo = mid;
    else hi = mid;
  }
  const u = (lo + hi) / 2;
  return cubic(t0, t1, t2, t3, u);
}

export function crossingsOf(comp: AuditComp, fps: number, threshold = IMPACT_THRESHOLD): Crossing[] {
  const out: Crossing[] = [];
  for (const layer of comp.layers) {
    for (const property of layer.animated ?? []) {
      if (!ENTRANCE_PROPERTIES.includes(property.path)) continue;
      const keys = property.keys;
      if (keys === undefined || keys.length < 2) continue;
      const first = keys[0] as AuditKeyframe;
      const last = keys[keys.length - 1] as AuditKeyframe;
      if (first.time === null || last.time === null) continue;

      const durationS = last.time - first.time;
      const deltaValue = delta(first.value, last.value);
      const base = {
        comp: comp.name,
        property: property.path,
        lastKeyS: last.time,
        lastKeyFrames: last.time * fps,
        linearFrames: (first.time + threshold * durationS) * fps,
      };

      if (deltaValue === null || durationS <= 0) {
        out.push({ ...base, crossingS: null, crossingFrames: null, unreadable: 'unreadable values' });
        continue;
      }

      /*
       * A spatial property such as Position reports **one** ease for all three
       * dimensions, because AE eases along the path — there the value axis is
       * the magnitude. A non-spatial multi-dimensional property such as Scale
       * reports **one ease per dimension**, and comparing a 3-D magnitude
       * against dimension 0's speed is a units error: it put Scale's crossing
       * at 7.27 frames where every other property gave 5.25.
       */
      const outCount = first.outEase?.length ?? 0;
      const perDimension =
        outCount > 1 && Array.isArray(first.value) && Array.isArray(last.value);
      if (perDimension) {
        const froms = first.value as number[];
        const tos = last.value as number[];
        let latest: number | null = null;
        let unreadable: string | null = null;
        for (let dim = 0; dim < outCount; dim += 1) {
          const dimDelta = (tos[dim] as number) - (froms[dim] as number);
          if (dimDelta === 0) continue;
          const oe = first.outEase?.[dim] ?? null;
          const ie = last.inEase?.[dim] ?? null;
          if (oe === null || ie === null) {
            unreadable = 'After Effects reported no temporal ease for this dimension';
            break;
          }
          const at = crossingTime({ durationS, deltaValue: dimDelta, outEase: oe, inEase: ie, threshold });
          if (at === null) continue;
          if (latest === null || at > latest) latest = at;
        }
        if (unreadable !== null || latest === null) {
          out.push({
            ...base,
            crossingS: null,
            crossingFrames: null,
            unreadable: unreadable ?? 'no dimension of this property moves',
          });
          continue;
        }
        const atAbs = first.time + latest;
        out.push({ ...base, crossingS: atAbs, crossingFrames: atAbs * fps, unreadable: null });
        continue;
      }

      const outEase = firstEase(first.outEase);
      const inEase = firstEase(last.inEase);
      if (outEase === null || inEase === null) {
        /*
         * A null ease is not linear. After Effects refused to report it, and
         * reading that as "no easing" would put a plausible number where a
         * missing one belongs.
         */
        out.push({
          ...base,
          crossingS: null,
          crossingFrames: null,
          unreadable: 'After Effects reported no temporal ease for this key; it is null, not linear',
        });
        continue;
      }

      const crossing = crossingTime({ durationS, deltaValue, outEase, inEase, threshold });
      if (crossing === null) {
        out.push({ ...base, crossingS: null, crossingFrames: null, unreadable: 'ease incomplete' });
        continue;
      }
      const at = first.time + crossing;
      out.push({ ...base, crossingS: at, crossingFrames: at * fps, unreadable: null });
    }
  }
  return out;
}

/**
 * A comp's impact: the **latest** crossing across its entrance properties, so
 * the moment everything has arrived rather than the first thing to.
 */
export function impactCrossingOf(
  comp: AuditComp,
  fps: number,
  threshold = IMPACT_THRESHOLD,
): { impactS: number | null; from: string | null; unreadable: string | null; all: Crossing[] } {
  const all = crossingsOf(comp, fps, threshold);
  const readable = all.filter((c) => c.crossingS !== null);
  if (readable.length === 0) {
    return {
      impactS: null,
      from: null,
      unreadable: all[0]?.unreadable ?? 'no entrance property with two readable keyframes',
      all,
    };
  }
  const latest = readable.reduce((a, b) => ((b.crossingS as number) > (a.crossingS as number) ? b : a));
  return { impactS: latest.crossingS, from: latest.property, unreadable: null, all };
}
