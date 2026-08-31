/**
 * How a card too wide for the safe width is made to fit: **break it if it can
 * be broken, and shrink it only when it cannot.**
 *
 * PROJECT_SPEC §3 ruling 3 as the user settled it on 2026-08-30, after looking
 * at a build made under the previous reading. That reading forced every
 * overlong card onto one line and scaled it down, which on `test-1`'s keyword
 * `محفزات الكولاجين` produced a card **56% the height of its neighbours** —
 * wide, thin, and smaller than the ordinary subtitle beside it. A keyword is
 * meant to be the largest thing on screen, so shrinking one inverts what it is
 * for. A card that has a space to break at goes onto two lines **at its
 * authored size**; shrinking is the last resort, for a single word with nowhere
 * to break.
 *
 * **Every decision is made on a width After Effects measured**, never on
 * arithmetic and never on a stored figure. Advance widths, kerning and Arabic
 * positional shaping would all have to be modelled otherwise, and a model of
 * what After Effects will draw is not what it draws. This module holds the
 * arithmetic between one measurement and the next, the policy, and the refusal
 * — the parts testable without a running host.
 */

/**
 * Bounded because a loop that cannot converge must fail loudly rather than
 * spin. Width is very nearly linear in font size, so one step lands almost
 * every card and a second covers the rounding; six is a backstop.
 */
export const SHRINK_MAX_ATTEMPTS = 6;

/**
 * Font sizes are floored to this many decimals rather than rounded.
 *
 * Rounding could round *up* and put a card back over the bound after the
 * arithmetic said it was under. Flooring can only ever be safe, and 1e-4 of a
 * point is orders of magnitude finer than anything the rendered width shows.
 */
export const SHRINK_SIZE_DECIMALS = 4;

export class CardTooWideError extends Error {}

export function needsShrink(measuredWidthPx: number, safeWidthPx: number): boolean {
  return measuredWidthPx > safeWidthPx;
}

/**
 * The size to try next, from the size just measured and the widest line it
 * produced.
 *
 * Mirrored in `panel/jsx/text-fit.jsx`, because the loop runs inside After
 * Effects where the measuring happens; `card-fit.test.ts` reads that file and
 * fails if the two drift, which is this repo's rule for a rule with more than
 * one implementation.
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

/** One measurement: the size and layout that were set, and what they produced. */
export interface ShrinkAttempt {
  fontSize: number;
  /** Whether the card carried its break at this attempt. */
  broken: boolean;
  /** The widest line, which is what the bound is applied to. */
  widthPx: number;
}

export interface ShrinkRow {
  reel: string;
  id: string;
  kind: 'subtitle' | 'keyword';
  /** The string placed on the layer, break character included. */
  text: string;
  /** The card's lines. One entry unless it was broken. */
  lines: string[];
  broken: boolean;
  templateId: string;
  font: string | null;
  /** The size the card would have had with no shrinking. */
  baseFontSize: number;
  finalFontSize: number;
  /** `finalFontSize / baseFontSize`, so 1 means untouched. */
  factor: number;
  /** The whole card on one line at full size, before anything was decided. */
  widthBeforePx: number;
  /** The widest line as finally placed. */
  widthAfterPx: number;
  lineWidthsPx: number[];
  safeWidthPx: number;
  attempts: number;
  measurements: ShrinkAttempt[];
  fits: boolean;
  /**
   * How far the card's ink reaches inside its own card comp, and how much room
   * that comp has.
   *
   * **A card is bounded in two directions and only one of them was ever
   * checked.** Block 10 session 20 found `test-1`'s `محفزات الكولاجين` drawing
   * from 374.2 to 1131.7 in a comp 1100 tall — cut by 31.7 px — while every
   * width check passed and 17,170 golden fields matched. `assertEveryCardFits`
   * asked `widthAfterPx <= safeWidthPx` and nothing asked anything about height.
   *
   * Optional with a default so a build older than this reports no height and is
   * not failed for it; a row that carries one is checked.
   */
  vertical?: CardVerticalExtent;
}

export interface CardVerticalExtent {
  /** The card comp's own height, read from the comp. */
  compHeightPx: number;
  /**
   * The lowest the ink reaches, in comp space, at the point in the entrance
   * where the card sits lowest.
   *
   * The templates animate Position from y=750 down to y=700, so a card sits 50px
   * lower while the entrance plays than it does at rest. Measuring only at rest
   * would report the best case of a card that is visibly clipped on its way in.
   */
  inkBottomPx: number;
  /** The highest the ink reaches, for the same reason in the other direction. */
  inkTopPx: number;
  /**
   * The shadow copy's extra reach, from the Transform effect that offsets it.
   *
   * **Composed rather than measured whole, and this is deliberate.**
   * `sourceRectAtTime` does not include an effect — measured in session 21,
   * `extents=true` and `extents=false` return identical rects on a layer
   * carrying one — so there is no single call that answers where the shadow's
   * ink lands. Both terms are measured: the rect from the layer, and the offset
   * read off the Transform effect's own Position and Anchor Point. Their sum is
   * arithmetic over two measurements, not an assumption.
   */
  shadowDropPx: number;
  /**
   * Whether the master's layer for this card collapses transformations.
   *
   * **The rule is that a card is never cut off, not that it fits its comp.** A
   * card comp is rasterised at its own bounds and clips whatever leaves them —
   * unless the master layer collapses, which renders the nested layers into the
   * master's own space and stops the bounds being a boundary. So ink outside a
   * comp is a defect only when the comp is enforcing its bounds.
   *
   * Read back off the placed layer rather than assumed: the check is allowed to
   * pass a card whose ink leaves its comp only because this took.
   *
   * Absent on a build older than session 21, which is treated as not collapsing
   * — the state every build was in when the defect was found.
   */
  collapsed?: boolean;
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
    .map((m) => `${m.fontSize}${m.broken ? ' broken' : ''} -> ${m.widthPx.toFixed(2)}px`)
    .join(', ');
  return (
    `${row.reel} ${row.id} (${row.kind}) cannot be brought under ` +
    `${row.safeWidthPx}px in ${row.attempts} attempts: "${row.text}" in ` +
    `${row.font ?? 'the template’s own face'} at ${row.baseFontSize}, ` +
    `${row.broken ? 'broken onto two lines' : 'with no break point'}. ` +
    `Measured ${seq}. The card is not clipped, so the build stops here.`
  );
}

/**
 * Every card the build reported, checked against the bound it was built to.
 *
 * The build never trusts the arithmetic that produced a size: this reads the
 * widest line After Effects measured last and refuses on the first card still
 * over, which is the assertion the ruling asks for.
 */
export class CardClippedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CardClippedError';
  }
}

/** How far a card's ink falls outside its comp. Zero or less means it fits. */
export function cardOverrunPx(v: CardVerticalExtent): { top: number; bottom: number } {
  return { top: -v.inkTopPx, bottom: v.inkBottomPx + v.shadowDropPx - v.compHeightPx };
}

export function cardClippedMessage(row: ShrinkRow, v: CardVerticalExtent): string {
  const over = cardOverrunPx(v);
  const which =
    over.bottom > 0 && over.top > 0
      ? `${over.bottom.toFixed(1)}px below and ${over.top.toFixed(1)}px above`
      : over.bottom > 0
        ? `${over.bottom.toFixed(1)}px below`
        : `${over.top.toFixed(1)}px above`;
  return (
    `${row.reel} ${row.id} (${row.kind}) is cut off by its own card comp: "${row.text}" in ` +
    `${row.font ?? 'the template’s own face'} at ${row.finalFontSize}, ` +
    `${row.broken ? 'broken onto two lines' : 'on one line'}, reaches ` +
    `${v.inkTopPx.toFixed(1)}px to ${(v.inkBottomPx + v.shadowDropPx).toFixed(1)}px ` +
    `(the word to ${v.inkBottomPx.toFixed(1)}px, its shadow ${v.shadowDropPx.toFixed(1)}px lower) ` +
    `in a comp ${v.compHeightPx}px tall — ${which} outside it, and that comp ` +
    `does not collapse, so nothing outside it is drawn. The build stops here.`
  );
}

/**
 * A card fits its comp in both directions, or the build refuses.
 *
 * The width half has been checked since Block 10 session 3. The height half did
 * not exist until session 21, which is why a clipped card reached the user
 * rather than a test.
 */
export function assertEveryCardFits(rows: ShrinkRow[]): void {
  for (const row of rows) {
    if (!row.fits || row.widthAfterPx > row.safeWidthPx) {
      throw new CardTooWideError(cardTooWideMessage(row));
    }
    const v = row.vertical;
    if (v === undefined || v.collapsed === true) continue;
    const over = cardOverrunPx(v);
    if (over.top > 0.5 || over.bottom > 0.5) {
      throw new CardClippedError(cardClippedMessage(row, v));
    }
  }
}

export interface ShrinkSummary {
  cards: number;
  /** Cards on one line at the size their template or style gives them. */
  untouched: number;
  /** Cards on two lines at full size — the ruling's preferred outcome. */
  broken: number;
  /** Cards whose type had to come down, with or without a break. */
  shrunk: number;
  /** Null when nothing was shrunk. */
  smallestFactor: number | null;
  totalAttempts: number;
  maxAttempts: number;
  widestAfterPx: number | null;
  safeWidthPx: number | null;
}

export function summariseShrinks(rows: ShrinkRow[]): ShrinkSummary {
  const shrunk = rows.filter((r) => r.factor < 1);
  const broken = rows.filter((r) => r.broken);
  return {
    cards: rows.length,
    untouched: rows.filter((r) => !r.broken && r.factor >= 1).length,
    broken: broken.length,
    shrunk: shrunk.length,
    smallestFactor: shrunk.length === 0 ? null : Math.min(...shrunk.map((r) => r.factor)),
    totalAttempts: rows.reduce((n, r) => n + r.attempts, 0),
    maxAttempts: rows.length === 0 ? 0 : Math.max(...rows.map((r) => r.attempts)),
    widestAfterPx: rows.length === 0 ? null : Math.max(...rows.map((r) => r.widthAfterPx)),
    safeWidthPx: rows[0]?.safeWidthPx ?? null,
  };
}
