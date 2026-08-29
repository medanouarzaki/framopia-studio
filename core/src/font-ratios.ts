/**
 * The size ratio between two faces, derived from what After Effects rendered.
 *
 * **Why this is a module and not arithmetic in a report.** Block 9 session 5
 * wrote `EMPHASIS_SIZE_RATIO = 1.3479` and, beside it, a consistency gate
 * reading "one word 1.35622 against phrase 1.37296, 1.234% apart, passed". The
 * written number lies outside both, because it came from the **x-height** while
 * the gate compared **advance widths** — two different quantities. The gate
 * passed and tested nothing about the number it appeared to justify. So the
 * derivation and its gate live in one place now, and the gate checks the
 * quantity that is actually used.
 */

export type RatioQuantity = 'capHeight' | 'xHeight' | 'oneWordAdvance' | 'phraseAdvance';

export const RATIO_QUANTITIES: RatioQuantity[] = [
  'capHeight',
  'xHeight',
  'oneWordAdvance',
  'phraseAdvance',
];

/** One face at one size, as `tools/ae/measure-fonts.jsx` reports it. */
export interface FaceMeasurementAtSize {
  size: number;
  capHeight: number;
  xHeight: number;
  oneWordText: string;
  oneWordAdvance: number;
  phraseText: string;
  phraseAdvance: number;
}

export interface FaceMeasurement {
  role: string;
  resolved?: boolean;
  fontUsed?: string;
  subtitle: FaceMeasurementAtSize;
  keyword: FaceMeasurementAtSize;
}

export interface RatioRow {
  quantity: RatioQuantity;
  /** Reference over face: how much larger the face must be set to match. */
  atSubtitleSize: number;
  atKeywordSize: number;
  /** The two sizes as a fraction of the smaller — 0 when they agree exactly. */
  sizeDisagreement: number;
  /**
   * Whether the two faces were measured on the **same string**. An advance
   * width compared across different text says nothing: Inter's `glow` against
   * Almarai's `شنو` is two strings, not one string in two faces.
   */
  comparable: boolean;
}

export interface RatioTable {
  reference: string;
  face: string;
  rows: RatioRow[];
}

function ratioAt(
  reference: FaceMeasurementAtSize,
  face: FaceMeasurementAtSize,
  quantity: RatioQuantity,
): number {
  const a = reference[quantity];
  const b = face[quantity];
  if (typeof a !== 'number' || typeof b !== 'number' || b === 0) {
    throw new Error(`cannot take a ${quantity} ratio from ${String(a)} over ${String(b)}`);
  }
  return a / b;
}

function comparableAt(
  reference: FaceMeasurementAtSize,
  face: FaceMeasurementAtSize,
  quantity: RatioQuantity,
): boolean {
  if (quantity === 'oneWordAdvance') return reference.oneWordText === face.oneWordText;
  if (quantity === 'phraseAdvance') return reference.phraseText === face.phraseText;
  // A single glyph is the same glyph in both faces by construction.
  return true;
}

export function ratioTable(reference: FaceMeasurement, face: FaceMeasurement): RatioTable {
  return {
    reference: reference.fontUsed ?? reference.role,
    face: face.fontUsed ?? face.role,
    rows: RATIO_QUANTITIES.map((quantity) => {
      const atSubtitleSize = ratioAt(reference.subtitle, face.subtitle, quantity);
      const atKeywordSize = ratioAt(reference.keyword, face.keyword, quantity);
      const smaller = Math.min(atSubtitleSize, atKeywordSize);
      return {
        quantity,
        atSubtitleSize,
        atKeywordSize,
        sizeDisagreement: Math.abs(atKeywordSize - atSubtitleSize) / smaller,
        comparable:
          comparableAt(reference.subtitle, face.subtitle, quantity) &&
          comparableAt(reference.keyword, face.keyword, quantity),
      };
    }),
  };
}

/**
 * How far two ratios may differ and still be one measurement of one thing.
 *
 * CHOSEN, NOT MEASURED. It is the figure Block 9 session 5's brief set for the
 * consistency check, kept because nothing has argued for another.
 */
export const RATIO_AGREEMENT_LIMIT = 0.03;

export interface RatioVerdict {
  /** The ratio a build should use, or null when the gate refuses. */
  ratio: number | null;
  quantity: RatioQuantity;
  /** The independent quantity the chosen one was checked against. */
  corroboratedBy: RatioQuantity | null;
  corroborationDisagreement: number | null;
  sizeDisagreement: number;
  passed: boolean;
  /** Why, in a sentence, whichever way it went. */
  reason: string;
}

/**
 * The ratio, gated on the quantity it is actually taken from.
 *
 * Two checks, and both are about the chosen quantity rather than about some
 * other one that happens to be in the same file:
 *
 * 1. **The same ratio at both sizes.** A ratio between two faces is a property
 *    of the faces; one that moves with the size is measuring something else.
 * 2. **An independent quantity agrees.** Cap height and x-height are two
 *    readings of "how tall does this face set"; advance width is a third, and
 *    it is only usable when both faces were given the **same string**.
 *
 * A quantity that cannot be corroborated is not refused for that alone — the
 * report says so and the size check still has to pass.
 */
export function chooseRatio(
  table: RatioTable,
  quantity: RatioQuantity,
  corroborateWith: RatioQuantity | null,
  limit = RATIO_AGREEMENT_LIMIT,
): RatioVerdict {
  const row = table.rows.find((r) => r.quantity === quantity);
  if (row === undefined) throw new Error(`no ${quantity} row in this table`);
  const mean = (row.atSubtitleSize + row.atKeywordSize) / 2;

  if (row.sizeDisagreement > limit) {
    return {
      ratio: null,
      quantity,
      corroboratedBy: null,
      corroborationDisagreement: null,
      sizeDisagreement: row.sizeDisagreement,
      passed: false,
      reason:
        `${quantity} gives ${row.atSubtitleSize.toFixed(5)} at one size and ` +
        `${row.atKeywordSize.toFixed(5)} at the other, ` +
        `${(row.sizeDisagreement * 100).toFixed(3)}% apart. A ratio between two faces does ` +
        'not move with the size, so this is measuring something other than the faces.',
    };
  }

  if (corroborateWith === null) {
    return {
      ratio: mean,
      quantity,
      corroboratedBy: null,
      corroborationDisagreement: null,
      sizeDisagreement: row.sizeDisagreement,
      passed: true,
      reason: `${quantity} is ${mean.toFixed(5)} at both sizes, and nothing independent was asked to confirm it.`,
    };
  }

  const other = table.rows.find((r) => r.quantity === corroborateWith);
  if (other === undefined) throw new Error(`no ${corroborateWith} row in this table`);
  if (!other.comparable) {
    return {
      ratio: null,
      quantity,
      corroboratedBy: corroborateWith,
      corroborationDisagreement: null,
      sizeDisagreement: row.sizeDisagreement,
      passed: false,
      reason:
        `${corroborateWith} cannot confirm anything here: the two faces were measured on ` +
        'different strings, so the widths are not a comparison.',
    };
  }
  const otherMean = (other.atSubtitleSize + other.atKeywordSize) / 2;
  const disagreement = Math.abs(otherMean - mean) / Math.min(otherMean, mean);
  const passed = disagreement <= limit;
  return {
    ratio: passed ? mean : null,
    quantity,
    corroboratedBy: corroborateWith,
    corroborationDisagreement: disagreement,
    sizeDisagreement: row.sizeDisagreement,
    passed,
    reason: passed
      ? `${quantity} is ${mean.toFixed(5)}, the same at both sizes, and ${corroborateWith} ` +
        `independently gives ${otherMean.toFixed(5)} — ${(disagreement * 100).toFixed(3)}% ` +
        `apart, within ${(limit * 100).toFixed(0)}%.`
      : `${quantity} gives ${mean.toFixed(5)} and ${corroborateWith} gives ` +
        `${otherMean.toFixed(5)}, ${(disagreement * 100).toFixed(3)}% apart, outside ` +
        `${(limit * 100).toFixed(0)}%. Two measures of the same thing that disagree that far ` +
        'are not measuring the same thing.',
  };
}
