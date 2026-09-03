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
 * ordinary Latin face in crème, emphasized words in the emphasis face in gold**,
 * and — from 2026-08-31 — **the shadow copy behind either in the client's deeper
 * colour**, `primary`. That last was the templates' own baked red until then,
 * which matched K2 only by coincidence of the brand.
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
  /**
   * The PostScript name. After Effects rejects any name containing a space.
   *
   * **Absent when this client has no measured faces**, and then the template's
   * own type is left alone while the colours still travel. `framopiaSetText`
   * writes `font` only when it is there, so a colour-only style is legal and
   * always was — it is what shrink-to-fit already sends.
   */
  font?: string;
  /** Absent when the template's own size is right, which is the usual case. */
  fontSize?: number;
  /** Three floats in 0..1, as After Effects wants them. */
  fillColor: [number, number, number];
  /**
   * The shadow copy's fill, which is the client's deeper colour.
   *
   * Carried beside the word's own rather than derived in the ExtendScript: one
   * resolution, in the module that already owns which colour a card is set in.
   */
  shadowFillColor: [number, number, number];
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
 * The face, size and colours a card is set in.
 *
 * **The face is absent when this client has no measured font names**, and then
 * the template's own type is left alone rather than have a name guessed for it:
 * After Effects accepts a font name it cannot resolve and renders a substitute
 * without saying so, so a guess would not fail, it would quietly set the wrong
 * type. The colours are always this client's.
 */
export function textStyleFor(inputs: TextStyleInputs): TextStyle {
  const { snapshot } = inputs;

  /*
   * **The colours travel whether or not the faces do.** They used to be the
   * same answer: no measured font names meant no style at all, so a client with
   * colours but no fonts had their cards drawn in the template's own — and the
   * template's shadow is `#820000`, which is K2 Syndicalia's Rouge. Every such
   * client got K2's shadow with nothing saying so. Block 10 session 45 found it
   * while proving a second client's palette reaches the comp.
   *
   * A face and a colour are separate things: a guessed font renders the wrong
   * type silently, which is why one is never guessed, but a colour the client
   * chose has nothing to guess about.
   */
  const colours = resolveTextColours(snapshot);
  const role = inputs.kind === 'keyword' ? colours.emphasis : colours.ordinary;
  const own = {
    fillColor: toAeColour(parseHexColour(role.hex)),
    shadowFillColor: toAeColour(parseHexColour(colours.shadow.hex)),
  };

  if (snapshot.fonts.status !== 'set') return own;
  const names = snapshot.fonts.postScriptNames;
  if (names === undefined) return own;

  if (isArabicTemplate(inputs.templateId)) {
    if (names.arabic === undefined) return own;
    // The `_ar` comps are already authored at ARABIC_SIZE_RATIO of the Latin
    // size, so the size is right and only the face and the colour move.
    return { font: names.arabic, ...own };
  }

  if (inputs.kind === 'keyword' && names.emphasis !== undefined) {
    const ratio = inputs.emphasisSizeRatio ?? EMPHASIS_SIZE_RATIO;
    return {
      font: names.emphasis,
      fontSize: Math.round(inputs.templateFontSize * ratio * 1000) / 1000,
      ...own,
    };
  }

  if (names.latin === undefined) return own;
  return { font: names.latin, ...own };
}

/** What the Arabic ratio is, for a report that wants to state it. */
export const ARABIC_RATIO_IN_TEMPLATES = ARABIC_SIZE_RATIO;
