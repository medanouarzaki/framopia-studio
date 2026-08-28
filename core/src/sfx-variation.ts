/**
 * Which sound an event fires, and whether it fires at all.
 *
 * The user listened to `vitasilk` and heard three hits in a row, 1.57 s and
 * 1.24 s apart, all of them the identical file — `hit_01` is bound to both
 * keyword templates and nothing else has ever been bound. Three of anything at
 * that spacing reads as a machine rather than as emphasis.
 *
 * Two rules, both deterministic and both applied to the events in time order,
 * so the same plan always produces the same build and no seed is needed.
 */

/**
 * Closer than this, two sounds of the same kind read as one stuttering event
 * rather than as two accents, and the second is dropped.
 *
 * **CHOSEN, NOT MEASURED**, 1.50 s. Judged by ear on a built reel; what it has
 * to clear is the corpus's tightest keyword pair at 1.235 s, which is the one
 * the user heard as mechanical.
 */
export const MIN_SFX_SPACING_S = 1.5;

/**
 * Within this of the previous sound of the same kind, firing the same file
 * again is heard as a repeat, so the next file of that kind is used instead.
 *
 * **CHOSEN, NOT MEASURED**, 3.00 s. Beyond it a repeat is not heard as one and
 * the preferred file is used again, which is why this is a window rather than a
 * blanket rotation: a reel with two keywords twenty seconds apart has no
 * problem to solve.
 */
export const SFX_VARIATION_WINDOW_S = 3;

export interface SfxCandidate {
  /** The element this sound belongs to. */
  elementId: string;
  /** Where the element starts, which is what "consecutive" is measured on. */
  startS: number;
  /** The sound the template binds. */
  sfxId: string;
  /**
   * Whether the sound may be dropped for being too close to its neighbour.
   * An image's sound may not: every image gets one.
   */
  droppable: boolean;
}

export interface SfxChoice extends SfxCandidate {
  /** What it actually fires, after variation. */
  chosenSfxId: string;
}

export interface SfxSelection {
  kept: SfxChoice[];
  dropped: { elementId: string; sfxId: string; sinceS: number }[];
}

/**
 * Apply the spacing rule and then the variation rule.
 *
 * Spacing first: there is no point choosing a different file for an event that
 * is about to be dropped, and dropping afterwards would leave a gap in the
 * rotation that depended on what was removed.
 *
 * `alternatives` gives, per kind, the files available in id order. A kind with
 * one file varies nothing and the rule is a no-op for it — which is the case
 * for whooshes today, and correctly so: no two images in this corpus are within
 * the window.
 */
export function selectSfx(
  candidates: SfxCandidate[],
  alternatives: (sfxId: string) => string[],
  options: { minSpacingS?: number; variationWindowS?: number } = {},
): SfxSelection {
  const minSpacing = options.minSpacingS ?? MIN_SFX_SPACING_S;
  const window = options.variationWindowS ?? SFX_VARIATION_WINDOW_S;

  const ordered = [...candidates].sort(
    (a, b) => a.startS - b.startS || (a.elementId < b.elementId ? -1 : 1),
  );

  const kept: SfxChoice[] = [];
  const dropped: SfxSelection['dropped'] = [];
  // Per bound sound: when it last fired and which alternative it used.
  const lastFired = new Map<string, { atS: number; index: number }>();

  for (const candidate of ordered) {
    const previous = lastFired.get(candidate.sfxId);
    const since = previous === undefined ? Infinity : candidate.startS - previous.atS;

    if (candidate.droppable && since < minSpacing - 1e-9) {
      dropped.push({
        elementId: candidate.elementId,
        sfxId: candidate.sfxId,
        sinceS: Number(since.toFixed(3)),
      });
      continue;
    }

    const files = alternatives(candidate.sfxId);
    const index =
      previous !== undefined && since < window - 1e-9 && files.length > 1
        ? (previous.index + 1) % files.length
        : 0;
    kept.push({ ...candidate, chosenSfxId: files[index] ?? candidate.sfxId });
    lastFired.set(candidate.sfxId, { atS: candidate.startS, index });
  }

  return { kept, dropped };
}
