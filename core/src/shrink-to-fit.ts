/**
 * An overlong card shrinks to fit. It never wraps and it never clips.
 *
 * PROJECT_SPEC §3 ruling 3, and the corpus contradicted it in both directions:
 * Block 10 session 2 measured nine cards over `SUBTITLE_SAFE_WIDTH`, of which
 * seven were single words the builder could not break and overhung, and two
 * were Arabic keyword spans the builder wrapped onto a second line. A wrapped
 * card also leaves the locked first-baseline anchor §5 fixes globally, so
 * wrapping was never the ruling's intent.
 *
 * **The width is measured inside After Effects, on the real instance comp,
 * after the text is set.** Nothing here predicts a width: advance widths,
 * kerning and Arabic positional shaping would all have to be modelled, and a
 * model of what After Effects will draw is not what it draws. This module holds
 * only the arithmetic between one measurement and the next, and the rules for
 * when to stop — the parts that can be tested without a running host.
 */

/**
 * Bounded because a loop that cannot converge must fail loudly rather than
 * spin. Width is very nearly linear in font size, so one step lands almost
 * every card and a second covers the rounding; six is far more than the corpus
 * needs and is a backstop, not an expectation.
 */
export const SHRINK_MAX_ATTEMPTS = 6;

/**
 * Font sizes are floored to this many decimals rather than rounded.
 *
 * Rounding could round *up* and put a card back over the bound after the
 * arithmetic said it was under. Flooring can only ever be safe, and 1e-4 of a
 * point is orders of magnitude finer than anything the rendered width can show.
 */
export const SHRINK_SIZE_DECIMALS = 4;

export class CardTooWideError extends Error {}

export function needsShrink(measuredWidthPx: number, safeWidthPx: number): boolean {
  return measuredWidthPx > safeWidthPx;
}

/**
 * The size to try next, from the size just measured and the width it produced.
 *
 * Mirrored in `panel/jsx/text-fit.jsx`, because the loop runs inside After
 * Effects where the measuring happens; `shrink-to-fit.test.ts` reads that file
 * and fails if the two drift, which is this repo's rule for a rule with more
 * than one implementation.
 */
export function nextFontSize(
  fontSize: number,
  measuredWidthPx: number,
  safeWidthPx: number,
): number {
  if (measuredWidthPx <= 0) {
    throw new CardTooWideError(
      `a card measured ${measuredWidthPx}px, which no font size can be derived from`,
    );
  }
  const scale = 10 ** SHRINK_SIZE_DECIMALS;
  return Math.floor((fontSize * safeWidthPx) / measuredWidthPx * scale) / scale;
}

/** One measurement: the size that was set, and the width it produced. */
export interface ShrinkAttempt {
  fontSize: number;
  widthPx: number;
}

export interface ShrinkRow {
  reel: string;
  id: string;
  kind: 'subtitle' | 'keyword';
  text: string;
  templateId: string;
  font: string | null;
  /** The size the card would have had with no shrinking. */
  baseFontSize: number;
  finalFontSize: number;
  /** `finalFontSize / baseFontSize`, so 1 means untouched. */
  factor: number;
  widthBeforePx: number;
  widthAfterPx: number;
  safeWidthPx: number;
  attempts: number;
  measurements: ShrinkAttempt[];
  fits: boolean;
}

/**
 * The sentence a build refuses with.
 *
 * It carries the whole attempt sequence rather than the last width: a card that
 * converged the wrong way and one that was already at the bound look identical
 * from a single number, and the person reading this cannot re-run the build.
 */
export function cardTooWideMessage(row: ShrinkRow): string {
  const seq = row.measurements
    .map((m) => `${m.fontSize} -> ${m.widthPx.toFixed(2)}px`)
    .join(', ');
  return (
    `${row.reel} ${row.id} (${row.kind}) cannot be brought under ` +
    `${row.safeWidthPx}px in ${row.attempts} attempts: "${row.text}" in ` +
    `${row.font ?? 'the template’s own face'} at ${row.baseFontSize}. ` +
    `Measured ${seq}. The card is not wrapped and not clipped, so the build stops here.`
  );
}

/**
 * Every card the build reported, checked against the bound it was built to.
 *
 * The build never trusts the arithmetic that produced a size: this reads the
 * width After Effects measured last and refuses on the first card that is still
 * over, which is the assertion §A.5 asks for.
 */
export function assertEveryCardFits(rows: ShrinkRow[]): void {
  for (const row of rows) {
    if (row.fits && row.widthAfterPx <= row.safeWidthPx) continue;
    throw new CardTooWideError(cardTooWideMessage(row));
  }
}

export interface ShrinkSummary {
  cards: number;
  /** Cards left at the size the template (or the emphasis ratio) gives them. */
  atFullSize: number;
  shrunk: number;
  /** Null when nothing was shrunk. */
  smallestFactor: number | null;
  largestShrinkPx: number | null;
  totalAttempts: number;
  maxAttempts: number;
  widestAfterPx: number | null;
  safeWidthPx: number | null;
}

export function summariseShrinks(rows: ShrinkRow[]): ShrinkSummary {
  const shrunk = rows.filter((r) => r.factor < 1);
  return {
    cards: rows.length,
    atFullSize: rows.length - shrunk.length,
    shrunk: shrunk.length,
    smallestFactor: shrunk.length === 0 ? null : Math.min(...shrunk.map((r) => r.factor)),
    largestShrinkPx:
      shrunk.length === 0 ? null : Math.max(...shrunk.map((r) => r.widthBeforePx - r.widthAfterPx)),
    totalAttempts: rows.reduce((n, r) => n + r.attempts, 0),
    maxAttempts: rows.length === 0 ? 0 : Math.max(...rows.map((r) => r.attempts)),
    widestAfterPx: rows.length === 0 ? null : Math.max(...rows.map((r) => r.widthAfterPx)),
    safeWidthPx: rows[0]?.safeWidthPx ?? null,
  };
}
