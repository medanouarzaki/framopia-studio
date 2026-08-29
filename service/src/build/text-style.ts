import {
  ARABIC_SIZE_RATIO,
  EMPHASIS_SIZE_RATIO,
  parseHexColour,
  resolveTextColours,
  toAeColour,
  type ClientSnapshot,
} from '@framopia/core';

/**
 * Which face, which size and which colour a card is set in.
 *
 * **The build sets these on the placeholder rather than the templates carrying
 * them per client.** Populating a placeholder is what the ExtendScript contract
 * already covers; the alternative is a hand-made copy of six comps for every
 * client, which is six chances to make them differ.
 *
 * The user's ruling, from K2's own brand chart: **ordinary words in the
 * ordinary Latin face in crème, emphasized words in the emphasis face in gold.**
 * Arabic keeps its own face at `ARABIC_SIZE_RATIO`, in the same colours — the
 * emphasis face is a Latin serif and has no Arabic, so an Arabic keyword is
 * gold Almarai rather than gold Cormorant.
 *
 * **A size only travels when it has to.** The template comps already carry the
 * right size for the ordinary and Arabic faces — 343 and 425, and 367 and 455
 * for the `_ar` variants, which is `ARABIC_SIZE_RATIO` already applied by hand.
 * The emphasis face is the one nothing anticipated, so it is the one case where
 * the build overrides the size, and leaving it alone would render Cormorant at
 * Inter's nominal size and read smaller than the words around it.
 */
export interface TextStyle {
  /** The PostScript name. After Effects rejects any name containing a space. */
  font: string;
  /** Absent when the template's own size is right, which is the usual case. */
  fontSize?: number;
  /** Three floats in 0..1, as After Effects wants them. */
  fillColor: [number, number, number];
}

/** `_ar` is how `assignTemplates` marks the Arabic variant of a template. */
export const SCRIPT_VARIANT_SUFFIX = '_ar';

export function isArabicTemplate(templateId: string): boolean {
  return templateId.endsWith(SCRIPT_VARIANT_SUFFIX);
}

export interface TextStyleInputs {
  kind: 'subtitle' | 'keyword';
  templateId: string;
  /** The size the template comp itself carries, from the audit. */
  templateFontSize: number;
  snapshot: ClientSnapshot;
  /** Overridden only to build the same reel at two ratios for comparison. */
  emphasisSizeRatio?: number;
}

/**
 * Null when this client has no measured font names.
 *
 * A client whose faces have never been checked on a host must build exactly as
 * it did before rather than have a name guessed for it: **After Effects accepts
 * a font name it cannot resolve and renders a substitute without saying so**, so
 * a guess would not fail, it would quietly set the wrong type.
 */
export function textStyleFor(inputs: TextStyleInputs): TextStyle | null {
  const { snapshot } = inputs;
  if (snapshot.fonts.status !== 'set') return null;
  const names = snapshot.fonts.postScriptNames;
  if (names === undefined) return null;

  const colours = resolveTextColours(snapshot);
  const role = inputs.kind === 'keyword' ? colours.emphasis : colours.ordinary;
  const fillColor = toAeColour(parseHexColour(role.hex));

  if (isArabicTemplate(inputs.templateId)) {
    if (names.arabic === undefined) return null;
    // The `_ar` comps are already authored at ARABIC_SIZE_RATIO of the Latin
    // size, so the size is right and only the face and the colour move.
    return { font: names.arabic, fillColor };
  }

  if (inputs.kind === 'keyword' && names.emphasis !== undefined) {
    const ratio = inputs.emphasisSizeRatio ?? EMPHASIS_SIZE_RATIO;
    return {
      font: names.emphasis,
      fontSize: Math.round(inputs.templateFontSize * ratio * 1000) / 1000,
      fillColor,
    };
  }

  if (names.latin === undefined) return null;
  return { font: names.latin, fillColor };
}

/** What the Arabic ratio is, for a report that wants to state it. */
export const ARABIC_RATIO_IN_TEMPLATES = ARABIC_SIZE_RATIO;
