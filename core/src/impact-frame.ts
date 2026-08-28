import type { AuditAnimatedProperty, AuditComp } from './templates.js';

/**
 * The frame at which a template's entrance resolves — the moment the animation
 * impacts, which is where a sound has to land.
 *
 * It is **not** the card's start. `kw_slam` moves and blurs into place over its
 * entrance, and a hit fired at the start of that lands before anything has
 * happened. The moment worth hitting is where the last entrance keyframe sits:
 * after it the pose is settled and nothing further moves.
 *
 * **Derived from the template's own keyframes, never authored.** The audit
 * emits every key's time; this reads them. If the audit has no keys — one taken
 * before session 21 — the answer is `null` with a reason, because an absent
 * measurement is not a measurement of zero.
 */
export interface ImpactFrame {
  comp: string;
  /** Seconds from the comp's start. Null when it cannot be derived. */
  impactS: number | null;
  impactFrames: number | null;
  /** Which property's last key decided it. */
  from: string | null;
  /** Why it could not be derived, when it could not. */
  unreadable: string | null;
}

/**
 * Properties whose motion is the entrance. A blur or an opacity ramp finishes
 * with the move, so the latest last-key across them is the settle point; a
 * property that keeps animating after the entrance would need naming here, and
 * none of the six templates has one.
 */
const ENTRANCE_PROPERTIES = ['Transform/Position', 'Transform/Scale', 'Transform/Opacity'];

function lastKeyTime(property: AuditAnimatedProperty): number | null {
  if (property.keys === undefined || property.keys.length === 0) return null;
  const times = property.keys
    .map((k) => k.time)
    .filter((t): t is number => typeof t === 'number');
  return times.length === 0 ? null : Math.max(...times);
}

export function impactFrameOf(comp: AuditComp, fps: number): ImpactFrame {
  const animated = comp.layers.flatMap((l) => l.animated ?? []);
  if (animated.length === 0) {
    return {
      comp: comp.name,
      impactS: null,
      impactFrames: null,
      from: null,
      unreadable: 'no animated property in the audit for this comp',
    };
  }

  const withKeys = animated.filter((p) => p.keys !== undefined);
  if (withKeys.length === 0) {
    return {
      comp: comp.name,
      impactS: null,
      impactFrames: null,
      from: null,
      unreadable:
        'this audit records keyframe counts but not their times; re-run npm run audit:templates',
    };
  }

  let bestTime: number | null = null;
  let bestFrom: string | null = null;
  for (const property of withKeys) {
    if (!ENTRANCE_PROPERTIES.includes(property.path)) continue;
    const time = lastKeyTime(property);
    if (time === null) continue;
    if (bestTime === null || time > bestTime) {
      bestTime = time;
      bestFrom = property.path;
    }
  }

  if (bestTime === null) {
    return {
      comp: comp.name,
      impactS: null,
      impactFrames: null,
      from: null,
      unreadable: `no entrance property among ${ENTRANCE_PROPERTIES.join(', ')} carries a readable key`,
    };
  }

  return {
    comp: comp.name,
    impactS: bestTime,
    impactFrames: bestTime * fps,
    from: bestFrom,
    unreadable: null,
  };
}
