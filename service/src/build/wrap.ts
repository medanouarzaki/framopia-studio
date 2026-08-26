/**
 * The break-point half of wrapping. **Measurement is not here** — only After
 * Effects can say how wide a string renders, and the builder is already inside
 * AE when it needs the answer (Block 7 session 5's ruling). This decides
 * *where* a break would go if one is needed; AE decides *whether* it is.
 *
 * The split is deliberate: this half is pure and unit-testable, the measuring
 * half is not testable outside a running AE, and the report says which is
 * which rather than implying the whole is covered.
 */
export const LINE_SEPARATOR = '\r';

export interface BreakCandidate {
  /** The whole string on one line. */
  oneLine: string;
  /** The same words with a break inserted, or null when no break is possible. */
  twoLines: string | null;
  /** The individual lines, for measuring each against the bound. */
  lines: string[];
  /** Why no break is possible, when `twoLines` is null. */
  reason: string | null;
}

/**
 * Subtitle groups hold one or two words and keyword spans are capped at two
 * (Block 3 session 3), so the only break a card can need is at its single
 * space. A string that somehow arrives with more spaces is broken at the one
 * nearest the middle by character count — an approximation, since character
 * count is not width, but it never runs on real corpus data and failing
 * loudly there would be worse than an imperfect guess this repo can see.
 */
export function chooseBreak(text: string): BreakCandidate {
  const trimmed = text.trim();
  const parts = trimmed.split(/\s+/).filter((p) => p.length > 0);

  if (parts.length <= 1) {
    return {
      oneLine: trimmed,
      twoLines: null,
      lines: [trimmed],
      reason: 'a single word has no break point',
    };
  }

  if (parts.length === 2) {
    const lines = [parts[0] as string, parts[1] as string];
    return { oneLine: trimmed, twoLines: lines.join(LINE_SEPARATOR), lines, reason: null };
  }

  let best = 1;
  let bestDelta = Infinity;
  for (let i = 1; i < parts.length; i += 1) {
    const left = parts.slice(0, i).join(' ').length;
    const right = parts.slice(i).join(' ').length;
    const delta = Math.abs(left - right);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = i;
    }
  }
  const lines = [parts.slice(0, best).join(' '), parts.slice(best).join(' ')];
  return { oneLine: trimmed, twoLines: lines.join(LINE_SEPARATOR), lines, reason: null };
}
