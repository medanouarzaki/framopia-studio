import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from './paths.js';
import { SUBTITLE_SAFE_WIDTH } from './typography.js';
import {
  type CardVerticalExtent,
  cardOverrunPx,
  cardClippedMessage,
  CardClippedError,
  CardTooWideError,
  SHRINK_MAX_ATTEMPTS,
  SHRINK_SIZE_DECIMALS,
  assertEveryCardFits,
  cardTooWideMessage,
  needsShrink,
  nextFontSize,
  summariseShrinks,
  type ShrinkRow,
} from './card-fit.js';

function row(over: Partial<ShrinkRow> = {}): ShrinkRow {
  return {
    reel: 'vitasilk',
    id: 'g071',
    kind: 'subtitle',
    text: 'matrddadich',
    lines: ['matrddadich'],
    broken: false,
    templateId: 'sub_pop',
    font: 'Inter-SemiBold',
    baseFontSize: 343,
    finalFontSize: 343,
    factor: 1,
    widthBeforePx: 1000,
    widthAfterPx: 1000,
    lineWidthsPx: [1000],
    safeWidthPx: SUBTITLE_SAFE_WIDTH,
    attempts: 1,
    measurements: [{ fontSize: 343, broken: false, widthPx: 1000 }],
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
  const widths: number[] = [baseWidth];
  let size = baseSize;
  let width = baseWidth;
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
  it('scales the size by the ratio the widest line overshot by', () => {
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

  it('refuses a width no size can be derived from', () => {
    expect(() => nextFontSize(343, 0, 1940)).toThrow(CardTooWideError);
  });
});

/*
 * The seven single words Block 10 session 2 measured over the bound. These are
 * the cards the ruling still shrinks, because there is no space to break at.
 * The widths are fixtures for the arithmetic, not inputs to a build.
 */
describe('convergence on the cards that have no break point', () => {
  const cards: [string, number, number][] = [
    ['ground-truth g026 polynucléotides', 343, 2617.3801],
    ['ground-truth g053 mésothérapie', 343, 2242.73],
    ['test-3 g007 mésothérapie', 343, 2242.73],
    ['test-3 g019 mésothérapie', 343, 2242.73],
    ['test-2 g026 hyaluronique', 343, 2126.67],
    ['test-3 g023 hyaluronique', 343, 2126.67],
    ['vitasilk g071 matrddadich', 343, 2047.95],
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
  it('refuses a card whose last measured line is still over', () => {
    expect(() => assertEveryCardFits([row({ widthAfterPx: 1941 })])).toThrow(CardTooWideError);
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
          { fontSize: 343, broken: false, widthPx: 2047.95 },
          { fontSize: 324.9, broken: false, widthPx: 1941 },
        ],
      }),
    );
    expect(message).toContain('vitasilk g071');
    expect(message).toContain('matrddadich');
    expect(message).toContain('Inter-SemiBold');
    expect(message).toContain('2047.95px');
    expect(message).toContain('1941.00px');
    expect(message).toContain('with no break point');
    expect(message).toContain('not clipped');
  });

  it('says a broken card was broken, and which attempts carried the break', () => {
    const message = cardTooWideMessage(
      row({
        id: 'k002',
        kind: 'keyword',
        broken: true,
        lines: ['محفزات', 'الكولاجين'],
        fits: false,
        attempts: 2,
        measurements: [
          { fontSize: 455, broken: false, widthPx: 3471.2 },
          { fontSize: 455, broken: true, widthPx: 1990 },
        ],
      }),
    );
    expect(message).toContain('broken onto two lines');
    expect(message).toContain('455 broken -> 1990.00px');
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
    expect(s).toMatchObject({ cards: 2, untouched: 2, broken: 0, shrunk: 0, smallestFactor: null });
  });

  /* A broken card keeps its authored size, which is the whole point. */
  it('counts a card broken at full size as broken and not as shrunk', () => {
    const s = summariseShrinks([
      row(),
      row({ id: 'k002', broken: true, lines: ['محفزات', 'الكولاجين'], widthAfterPx: 1800 }),
    ]);
    expect(s).toMatchObject({ cards: 2, untouched: 1, broken: 1, shrunk: 0 });
    expect(s.smallestFactor).toBeNull();
  });

  it('counts a card that had to do both in each column', () => {
    const s = summariseShrinks([
      row(),
      row({ id: 'k002', broken: true, factor: 0.8, finalFontSize: 364, widthAfterPx: 1930 }),
    ]);
    expect(s).toMatchObject({ cards: 2, untouched: 1, broken: 1, shrunk: 1 });
    expect(s.smallestFactor).toBeCloseTo(0.8, 9);
  });

  it('reports the widest surviving line', () => {
    const s = summariseShrinks([row({ widthAfterPx: 1000 }), row({ id: 'g2', widthAfterPx: 1939 })]);
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
  const build = readFileSync(path.join(REPO_ROOT, 'panel', 'jsx', 'build-reel.jsx'), 'utf8');

  it('computes the next size the same way', () => {
    const scale = 10 ** SHRINK_SIZE_DECIMALS;
    expect(jsx).toContain(
      `return Math.floor(fontSize * safeWidth / measuredWidth * ${scale}) / ${scale};`,
    );
  });

  it('never writes the layer’s Scale, which the templates animate', () => {
    const fit = jsx.slice(jsx.indexOf('function framopiaFitCard'));
    expect(fit).not.toContain("property('Scale')");
    expect(fit).toContain('fontSize');
  });

  /* The ruling: break first, and only then reduce the size. */
  it('tries the break before it tries a smaller size', () => {
    const fit = jsx.slice(jsx.indexOf('function framopiaFitCard'));
    const breakAt = fit.indexOf('candidate.twoLines');
    const shrinkAt = fit.indexOf('framopiaShrinkNextSize(');
    expect(breakAt).toBeGreaterThan(-1);
    expect(shrinkAt).toBeGreaterThan(breakAt);
  });

  it('keeps whatever break was made while it shrinks', () => {
    expect(jsx).toContain('framopiaSetText(layer, out.text, { fontSize: size });');
  });

  it('exits on a measured width rather than on the arithmetic', () => {
    expect(jsx).toContain('while (width > safeWidth && out.attempts < limit)');
    expect(jsx).toContain('out.fits = width <= safeWidth;');
  });

  it('the builder hands over the whole candidate and refuses one it cannot fit', () => {
    expect(build).toContain('framopiaFitCard(');
    expect(build).toContain('e.candidate, o.safeWidth');
    expect(build).toContain('if (!e.shrink.fits)');
  });

  it('gives the shadow the placed string and the landed size, and checks both back', () => {
    expect(build).toContain('var shadowStyle = { fontSize: e.shrink.finalFontSize };');
    expect(build).toContain('framopiaSetText(shadow, e.shrink.text, shadowStyle);');
    expect(build).toContain('must carry the same size');
    expect(build).toContain('Both layers carry the same string, break included.');
  });

  it('parks on the first card that was broken or shrunk', () => {
    expect(build).toContain('if (fit && (fit.broken || fit.factor < 1))');
  });
});

describe('a card that its own comp cuts off', () => {
  const row = (vertical: CardVerticalExtent): ShrinkRow => ({
    reel: 'test_1', id: 'k002', kind: 'keyword', text: 'محفزات\rالكولاجين',
    lines: ['محفزات', 'الكولاجين'], broken: true, templateId: 'kw_slam_ar',
    font: 'Almarai-Bold', baseFontSize: 455, finalFontSize: 455, factor: 1,
    widthBeforePx: 3471.2, widthAfterPx: 1815.9, lineWidthsPx: [1508.8, 1815.9],
    safeWidthPx: 1940, attempts: 2, measurements: [], fits: true, vertical,
  });

  /** The real card, measured in After Effects in Block 10 session 21. */
  const cut: CardVerticalExtent = {
    compHeightPx: 1100, inkTopPx: 374.2, inkBottomPx: 1181.7, shadowDropPx: 15,
  };

  it('refuses it, naming both values and the overrun', () => {
    expect(() => assertEveryCardFits([row(cut)])).toThrow(CardClippedError);
    const said = cardClippedMessage(row(cut), cut);
    expect(said).toContain('1100px tall');
    expect(said).toContain('96.7px below');
    expect(said).toContain('1196.7px');
  });

  /**
   * The shadow is why 96.7 and not 81.7. `sourceRectAtTime` excludes the
   * Transform effect at either `extents` setting — measured — so the drop is a
   * separate term and must be in the sum.
   */
  it('counts the shadow’s drop, which no single measurement includes', () => {
    expect(cardOverrunPx({ ...cut, shadowDropPx: 0 }).bottom).toBeCloseTo(81.7, 1);
    expect(cardOverrunPx(cut).bottom).toBeCloseTo(96.7, 1);
  });

  it('passes a card that fits, with the same shape of record', () => {
    const fits: CardVerticalExtent = { ...cut, inkBottomPx: 900, shadowDropPx: 15 };
    expect(() => assertEveryCardFits([row(fits)])).not.toThrow();
  });

  /**
   * The rule is that a card is never cut, not that it fits its comp: a comp that
   * does not enforce its bounds cannot cut anything. Option D would have relied
   * on this and was rejected on measurement, so nothing sets it today — but the
   * check must not fail a card that genuinely is not being cut.
   */
  it('does not fail a card whose comp does not clip it', () => {
    expect(() => assertEveryCardFits([row({ ...cut, collapsed: true })])).not.toThrow();
  });

  it('is silent about height on a build that reported none', () => {
    const noHeight = { ...row(cut) };
    delete (noHeight as { vertical?: unknown }).vertical;
    expect(() => assertEveryCardFits([noHeight])).not.toThrow();
  });

  it('still refuses a card that is too wide, before it looks at height', () => {
    expect(() => assertEveryCardFits([{ ...row(cut), widthAfterPx: 9999 }])).toThrow(
      CardTooWideError,
    );
  });
});
