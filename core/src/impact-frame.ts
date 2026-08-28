import type { AuditAnimatedProperty, AuditComp } from './templates.js';

/**
 * The frame at which a template's entrance **finishes settling** — its last
 * entrance keyframe.
 *
 * **This is not the impact frame, and Block 8 session 23 established that it
 * never was.** The user built these templates: the easing front-loads the
 * motion, so on `kw_slam` the word has visually landed by **frame 4** while the
 * last key sits at frame 12. Frames 4 to 12 are the tail settling. Sound placed
 * on the settle lands 8 frames late.
 *
 * The impact is where an animated property first reaches
 * `IMPACT_THRESHOLD` of its final value, which needs the **interpolated
 * curve** — and the curve needs the easing, which the audit did not record
 * until session 23 extended it. `impactFrameOf` is kept because the settle
 * frame is a real measurement and the validator has other uses for it; it is
 * named for what it measures so nothing reads it as the impact again.
 *
 * **Derived from the template's own keyframes, never authored.** An audit with
 * no keys answers `null` with a reason: an absent measurement is not a
 * measurement of zero.
 */
/**
 * The share of its final value an animated property must reach for the motion
 * to read as arrived.
 *
 * **CHOSEN, NOT MEASURED**, 0.90 — which puts every comp's crossing at 4.06
 * frames.
 *
 * It was 0.95, giving 5.25 frames, and the user — who drew these curves — puts
 * `kw_slam`'s arrival at frame 4, which corresponds to 0.8966. Nothing shipped
 * on that disagreement while it was theoretical. He has now heard the sounds
 * land late, so the choice is being made rather than deferred: **where a
 * measurement and the author of the animation disagree by less than two frames,
 * the author decides.** 0.90 is his figure to within a sixteenth of a frame,
 * and it is a round number rather than one fitted to a single comp.
 *
 * The 8-frame error he is hearing is not this 1.25-frame difference — the
 * sounds sat on the *settle* at frame 12. Either threshold fixes most of it;
 * this one also matches the eye that made the animation.
 */
export const IMPACT_THRESHOLD = 0.9;

export interface ImpactFrame {
  comp: string;
  /**
   * The **settle** — the last entrance keyframe — in seconds. Null when it
   * cannot be derived. Named `impactS` while the field is what SFX placement
   * reads; session 23 established the two are not the same and the impact is
   * earlier.
   */
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
