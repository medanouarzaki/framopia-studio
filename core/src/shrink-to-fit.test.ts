import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from './paths.js';
import { SUBTITLE_SAFE_WIDTH } from './typography.js';
import {
  CardTooWideError,
  SHRINK_MAX_ATTEMPTS,
  SHRINK_SIZE_DECIMALS,
  assertEveryCardFits,
  cardTooWideMessage,
  needsShrink,
  nextFontSize,
  summariseShrinks,
  type ShrinkRow,
} from './shrink-to-fit.js';

function row(over: Partial<ShrinkRow> = {}): ShrinkRow {
  return {
    reel: 'vitasilk',
    id: 'g071',
    kind: 'subtitle',
    text: 'matrddadich',
    templateId: 'sub_pop',
    font: 'Inter-SemiBold',
    baseFontSize: 343,
    finalFontSize: 343,
    factor: 1,
    widthBeforePx: 1000,
    widthAfterPx: 1000,
    safeWidthPx: SUBTITLE_SAFE_WIDTH,
    attempts: 1,
    measurements: [{ fontSize: 343, widthPx: 1000 }],
    fits: true,
    ...over,
  };
}

/**
 * Width is very nearly linear in font size, which is what makes one step land
 * almost every card. It is not exactly linear — hinting and rounding move it —
 * so the loop measures again rather than trusting this.
 */
function widthAt(fontSize: number, baseSize: number, baseWidth: number): number {
  return (baseWidth * fontSize) / baseSize;
}

function converge(baseSize: number, baseWidth: number, safe: number): number[] {
  const widths: number[] = [];
  let size = baseSize;
  let width = baseWidth;
  widths.push(width);
  let attempts = 1;
  while (width > safe && attempts < SHRINK_MAX_ATTEMPTS) {
    size = nextFontSize(size, width, safe);
    width = widthAt(size, baseSize, baseWidth);
    widths.push(width);
    attempts += 1;
  }
  return widths;
}

describe('needsShrink', () => {
  it('is false at the bound and true past it', () => {
    expect(needsShrink(1940, 1940)).toBe(false);
    expect(needsShrink(1940.0001, 1940)).toBe(true);
    expect(needsShrink(100, 1940)).toBe(false);
  });
});

describe('nextFontSize', () => {
  it('scales the size by the ratio the width overshot by', () => {
    expect(nextFontSize(343, 3880, 1940)).toBeCloseTo(171.5, 4);
  });

  /* Rounding up would put a card back over a bound the arithmetic cleared. */
  it('floors rather than rounds, so it can never overshoot', () => {
    const measured = 2047.95001220703;
    const size = nextFontSize(343, measured, 1940);
    expect(size).toBeLessThanOrEqual((343 * 1940) / measured);
    const scale = 10 ** SHRINK_SIZE_DECIMALS;
    expect(Number.isInteger(Math.round(size * scale))).toBe(true);
  });

  it('leaves a card that already fits alone by returning a larger size', () => {
    expect(nextFontSize(343, 970, 1940)).toBe(686);
  });

  it('refuses a width no size can be derived from', () => {
    expect(() => nextFontSize(343, 0, 1940)).toThrow(CardTooWideError);
  });
});

/*
 * The nine cards Block 10 session 2 measured over the bound. The widths are
 * fixtures for the arithmetic, not inputs to a build: the build measures its
 * own.
 */
describe('convergence on the corpus’ real overflowing cards', () => {
  const cards: [string, number, number][] = [
    ['test-1 k002 محفزات الكولاجين', 455, 3471.1952],
    ['ground-truth g026 polynucléotides', 343, 2617.3801],
    ['test-2 k002 ترطيب عميق', 455, 2449.7201],
    ['ground-truth g053 mésothérapie', 343, 2242.7300],
    ['test-3 g007 mésothérapie', 343, 2242.7300],
    ['test-3 g019 mésothérapie', 343, 2242.7300],
    ['test-2 g026 hyaluronique', 343, 2126.6700],
    ['test-3 g023 hyaluronique', 343, 2126.6700],
    ['vitasilk g071 matrddadich', 343, 2047.9500],
  ];

  it.each(cards)('%s lands under the bound', (_name, size, width) => {
    const widths = converge(size, width, SUBTITLE_SAFE_WIDTH);
    expect(widths[widths.length - 1]).toBeLessThanOrEqual(SUBTITLE_SAFE_WIDTH);
    expect(widths.length).toBeLessThanOrEqual(SHRINK_MAX_ATTEMPTS);
  });

  it('needs one step under a linear model, so six is a backstop', () => {
    for (const [, size, width] of cards) {
      expect(converge(size, width, SUBTITLE_SAFE_WIDTH)).toHaveLength(2);
    }
  });

  it('never enlarges a card that already fits', () => {
    expect(converge(343, 1751.51, SUBTITLE_SAFE_WIDTH)).toEqual([1751.51]);
  });
});

describe('assertEveryCardFits', () => {
  it('passes a set that is all under the bound', () => {
    expect(() => assertEveryCardFits([row(), row({ id: 'g002' })])).not.toThrow();
  });

  /* The build never trusts the arithmetic that produced the size. */
  it('refuses a card whose last measured width is still over', () => {
    expect(() =>
      assertEveryCardFits([row({ widthAfterPx: 1941, fits: true })]),
    ).toThrow(CardTooWideError);
  });

  it('refuses a card the host itself reported as not fitting', () => {
    expect(() => assertEveryCardFits([row({ fits: false })])).toThrow(CardTooWideError);
  });

  it('names the card, its face, its size and every measured width', () => {
    const message = cardTooWideMessage(
      row({
        fits: false,
        attempts: 2,
        measurements: [
          { fontSize: 343, widthPx: 2047.95 },
          { fontSize: 324.9, widthPx: 1941 },
        ],
      }),
    );
    expect(message).toContain('vitasilk g071');
    expect(message).toContain('matrddadich');
    expect(message).toContain('Inter-SemiBold');
    expect(message).toContain('343');
    expect(message).toContain('2047.95px');
    expect(message).toContain('1941.00px');
    expect(message).toContain('not wrapped and not clipped');
  });

  it('says so when the client carries no face', () => {
    expect(cardTooWideMessage(row({ font: null, fits: false }))).toContain(
      'the template’s own face',
    );
  });
});

describe('summariseShrinks', () => {
  it('counts an untouched set as untouched', () => {
    const s = summariseShrinks([row(), row({ id: 'g002' })]);
    expect(s).toMatchObject({ cards: 2, shrunk: 0, atFullSize: 2, smallestFactor: null });
  });

  it('reports the smallest factor and the widest surviving card', () => {
    const s = summariseShrinks([
      row(),
      row({ id: 'g071', factor: 0.5589, finalFontSize: 191.7, widthBeforePx: 3471, widthAfterPx: 1939 }),
      row({ id: 'g026', factor: 0.9122, widthAfterPx: 1930 }),
    ]);
    expect(s.cards).toBe(3);
    expect(s.shrunk).toBe(2);
    expect(s.atFullSize).toBe(1);
    expect(s.smallestFactor).toBeCloseTo(0.5589, 6);
    expect(s.largestShrinkPx).toBeCloseTo(1532, 6);
    expect(s.widestAfterPx).toBe(1939);
  });

  it('handles an empty set without inventing a figure', () => {
    expect(summariseShrinks([])).toMatchObject({
      cards: 0,
      widestAfterPx: null,
      safeWidthPx: null,
    });
  });
});

/*
 * The loop runs inside After Effects, where the measuring happens, so the
 * arithmetic has two implementations. This repo's rule for that is a test that
 * reads both and fails when they drift; a comment saying "keep in sync" is not.
 */
describe('the ExtendScript mirror', () => {
  const jsx = readFileSync(path.join(REPO_ROOT, 'panel', 'jsx', 'text-fit.jsx'), 'utf8');

  it('computes the next size the same way', () => {
    const scale = 10 ** SHRINK_SIZE_DECIMALS;
    expect(jsx).toContain(
      `return Math.floor(fontSize * safeWidth / measuredWidth * ${scale}) / ${scale};`,
    );
  });

  it('never writes the layer’s Scale, which the templates animate', () => {
    const shrink = jsx.slice(jsx.indexOf('function framopiaShrinkToFit'));
    expect(shrink).not.toContain("property('Scale')");
    expect(shrink).toContain('fontSize');
  });

  it('exits on a measured width rather than on the arithmetic', () => {
    expect(jsx).toContain('while (measured.width > safeWidth && out.attempts < limit)');
    expect(jsx).toContain('out.fits = measured.width <= safeWidth;');
  });

  it('the builder sets the card whole and refuses one it cannot fit', () => {
    const build = readFileSync(path.join(REPO_ROOT, 'panel', 'jsx', 'build-reel.jsx'), 'utf8');
    expect(build).toContain('framopiaShrinkToFit(');
    expect(build).toContain('e.candidate.oneLine');
    expect(build).toContain('if (!e.shrink.fits)');
    expect(build).not.toContain('framopiaFittedText');
  });

  it('gives the shadow the size the shrink landed on and checks both back', () => {
    const build = readFileSync(path.join(REPO_ROOT, 'panel', 'jsx', 'build-reel.jsx'), 'utf8');
    expect(build).toContain('var shadowStyle = { fontSize: e.shrink.finalFontSize };');
    expect(build).toContain('e.shadowApplied = framopiaReadTextStyle(shadow);');
    expect(build).toContain('must carry the same size');
  });
});
