import { describe, expect, it } from 'vitest';
import {
  CompCensusError,
  parseElementComp,
  shapeCensus,
  type RawCensus,
  type RawComp,
  type RawLayer,
} from './comp-census.js';
import type { TemplateEntry } from './templates.js';

function template(over: Partial<TemplateEntry> = {}): TemplateEntry {
  return {
    id: 'sub_pop',
    file: 'library.aep',
    type: 'subtitle',
    placeholders: ['TXT_MAIN'],
    shadowLayers: ['TXT_MAIN_SHADOW'],
    introS: 0.13,
    outroS: 0,
    minHoldS: 0.1,
    anchor: 'center',
    imagePresentation: null,
    sfx: [],
    notes: '',
    ...over,
  } as TemplateEntry;
}

function textLayer(name: string, text: string, over: Partial<RawLayer> = {}): RawLayer {
  return {
    name,
    index: 1,
    kind: 'text',
    text,
    font: 'Inter-SemiBold',
    fontSize: 343,
    tracking: 0,
    fillColor: [1, 1, 1],
    ...over,
  };
}

function textComp(name: string, layers: RawLayer[]): RawComp {
  return {
    name,
    width: 2160,
    height: 1100,
    duration: 2.002,
    frameRate: 29.97,
    numLayers: layers.length,
    layers,
  };
}

function raw(comps: RawComp[]): RawCensus {
  return {
    ok: true,
    aeVersion: '26.0x67',
    projectFile: '/x/vitasilk-full.aep',
    projectDirty: false,
    numItems: comps.length,
    fontNameCount: 1198,
    comps,
  };
}

function shape(comps: RawComp[], over: Partial<Parameters<typeof shapeCensus>[0]> = {}) {
  return shapeCensus({
    raw: raw(comps),
    aepPath: '/x/vitasilk-full.aep',
    aepSha256: 'abc',
    measuredAt: '2026-08-30T00:00:00.000Z',
    templates: [template(), template({ id: 'img_float', type: 'image', placeholders: ['IMG_MAIN'] })],
    placeholderWords: ['kan9olo'],
    ...over,
  });
}

describe('parseElementComp', () => {
  it('splits a built instance into its element and its template', () => {
    expect(parseElementComp('g027__sub_pop')).toEqual({
      compName: 'g027__sub_pop',
      elementId: 'g027',
      templateId: 'sub_pop',
    });
  });

  it('returns null for a library comp, which carries no separator', () => {
    expect(parseElementComp('sub_pop')).toBeNull();
  });

  it('refuses a name that is ambiguous rather than guessing which half is which', () => {
    expect(parseElementComp('a__b__c')).toBeNull();
    expect(parseElementComp('__sub_pop')).toBeNull();
    expect(parseElementComp('g027__')).toBeNull();
  });
});

describe('shapeCensus', () => {
  it('counts a filled card as clean', () => {
    const c = shape([
      textComp('g001__sub_pop', [
        textLayer('TXT_MAIN', 'dernière'),
        textLayer('TXT_MAIN_SHADOW', 'dernière', { index: 2 }),
      ]),
    ]);
    expect(c.summary.textCompCount).toBe(1);
    expect(c.summary.textLayersChecked).toBe(2);
    expect(c.summary.placeholderWordsSurviving).toBe(0);
    expect(c.summary.compsWherePlaceholderAndShadowDiffer).toBe(0);
    expect(c.textComps[0]?.placeholderShadowAgree).toBe(true);
  });

  it('catches a placeholder word the build never reached', () => {
    const c = shape([
      textComp('g001__sub_pop', [
        textLayer('TXT_MAIN', 'dernière'),
        textLayer('TXT_MAIN_SHADOW', 'kan9olo', { index: 2 }),
      ]),
    ]);
    expect(c.summary.placeholderWordsSurviving).toBe(1);
    expect(c.summary.compsWherePlaceholderAndShadowDiffer).toBe(1);
  });

  /*
   * The Block 9 defect exactly: a hand pass duplicated TXT_MAIN, the copy kept
   * the template's word, and the build filled by exact name and never saw it.
   */
  it('reports a text layer the template declares neither way', () => {
    const c = shape([
      textComp('g001__sub_pop', [
        textLayer('TXT_MAIN', 'dernière'),
        textLayer('TXT_MAIN_SHADOW', 'dernière', { index: 2 }),
        textLayer('TXT_MAIN 2', 'kan9olo', { index: 3 }),
      ]),
    ]);
    expect(c.textComps[0]?.undeclaredTextLayers).toEqual(['TXT_MAIN 2']);
    expect(c.summary.compsWithUndeclaredTextLayer).toBe(1);
    expect(c.summary.placeholderWordsSurviving).toBe(1);
  });

  it('reports a declared layer that is not in the comp', () => {
    const c = shape([textComp('g001__sub_pop', [textLayer('TXT_MAIN', 'dernière')])]);
    expect(c.textComps[0]?.missingDeclared).toEqual(['TXT_MAIN_SHADOW']);
    expect(c.summary.compsWithMissingDeclaredLayer).toBe(1);
    expect(c.textComps[0]?.placeholderShadowAgree).toBeNull();
  });

  it('counts an empty string as empty rather than as a filled layer', () => {
    const c = shape([
      textComp('g001__sub_pop', [
        textLayer('TXT_MAIN', ''),
        textLayer('TXT_MAIN_SHADOW', '', { index: 2 }),
      ]),
    ]);
    expect(c.summary.emptyTextLayers).toBe(2);
  });

  it('names a font the client does not declare', () => {
    const c = shape(
      [
        textComp('g001__sub_pop', [
          textLayer('TXT_MAIN', 'a', { font: 'Helvetica' }),
          textLayer('TXT_MAIN_SHADOW', 'a', { index: 2 }),
        ]),
      ],
      { expectedFonts: ['Inter-SemiBold'] },
    );
    expect(c.summary.fontsSeen).toEqual(['Helvetica', 'Inter-SemiBold']);
    expect(c.summary.unexpectedFonts).toEqual(['Helvetica']);
  });

  it('reports no unexpected font when the caller declares none to expect', () => {
    const c = shape([
      textComp('g001__sub_pop', [textLayer('TXT_MAIN', 'a', { font: 'Helvetica' })]),
    ]);
    expect(c.summary.unexpectedFonts).toEqual([]);
  });

  it('separates library comps from built instances', () => {
    const c = shape([
      textComp('sub_pop', [textLayer('TXT_MAIN', 'kan9olo')]),
      textComp('g001__sub_pop', [textLayer('TXT_MAIN', 'dernière')]),
    ]);
    expect(c.summary.libraryCompCount).toBe(1);
    expect(c.summary.elementCompCount).toBe(1);
    /* The library comp still holds its placeholder word, and must not count. */
    expect(c.summary.placeholderWordsSurviving).toBe(0);
  });

  it('classifies a master comp’s layers by what they really are', () => {
    const master: RawComp = {
      name: 'master_final',
      width: 2160,
      height: 3840,
      duration: 25.69,
      frameRate: 29.97,
      numLayers: 5,
      layers: [
        { name: 'whoosh_01.wav', index: 1, kind: 'av', sourceFile: '/repo/assets/sfx/whoosh_01.wav' },
        { name: 'intro.mov', index: 2, kind: 'av', sourceFile: '/repo/assets/watermark/intro.mov' },
        { name: 'img001__img_float', index: 3, kind: 'av', sourceIsComp: true, sourceName: 'img001__img_float' },
        { name: 'g001__sub_pop', index: 4, kind: 'av', sourceIsComp: true, sourceName: 'g001__sub_pop' },
        { name: 'vitasilk.mov', index: 5, kind: 'av', sourceFile: '/videos/vitasilk.mov' },
      ],
    };
    const c = shape([master]);
    expect(c.masters).toHaveLength(1);
    expect(c.masters[0]?.roleCounts).toEqual({
      footage: 1,
      watermark: 1,
      sfx: 1,
      image: 1,
      text: 1,
      unknown: 0,
    });
  });

  /*
   * Both are QuickTime, so the extension cannot tell them apart; only the
   * watermark lives in the repository's assets folder.
   */
  it('does not read the reel as a watermark because both are .mov', () => {
    const c = shape([
      {
        name: 'master_final',
        width: 2160,
        height: 3840,
        duration: 1,
        frameRate: 29.97,
        numLayers: 1,
        layers: [{ name: 'reel.mov', index: 1, kind: 'av', sourceFile: '/videos/reel.mov' }],
      },
    ]);
    expect(c.masters[0]?.roleCounts.watermark).toBe(0);
    expect(c.masters[0]?.roleCounts.footage).toBe(1);
  });

  it('throws rather than shaping a refusal into a document', () => {
    expect(() =>
      shapeCensus({
        raw: { ok: false, stage: 'check-project', message: 'that is a different project' },
        aepPath: '/x.aep',
        aepSha256: 'abc',
        measuredAt: 'now',
        templates: [],
        placeholderWords: [],
      }),
    ).toThrow(CompCensusError);
  });

  it('carries its own inputs, so a figure can be traced back', () => {
    const c = shape([textComp('g001__sub_pop', [textLayer('TXT_MAIN', 'a')])]);
    expect(c.aepPath).toBe('/x/vitasilk-full.aep');
    expect(c.aepSha256).toBe('abc');
    expect(c.aeVersion).toBe('26.0x67');
    expect(c.measuredAt).toBe('2026-08-30T00:00:00.000Z');
    expect(c.schemaVersion).toBe(1);
  });
});

describe('shrink-to-fit, seen from the census', () => {
  function card(id: string, size: number, shadowSize = size, font = 'Inter-SemiBold') {
    return textComp(`${id}__sub_pop`, [
      textLayer('TXT_MAIN', id, { fontSize: size, font }),
      textLayer('TXT_MAIN_SHADOW', id, { index: 2, fontSize: shadowSize, font }),
    ]);
  }

  it('records the placeholder’s size on the comp', () => {
    const c = shape([card('g001', 343)]);
    expect(c.textComps[0]?.fontSizePx).toBe(343);
  });

  it('derives the full size from the dump and counts what is below it', () => {
    const c = shape([card('g001', 343), card('g002', 343), card('g071', 324.9)]);
    expect(c.summary.cardsAtFullSize).toBe(2);
    expect(c.summary.cardsShrunk).toBe(1);
    expect(c.summary.smallestSizeFactor).toBeCloseTo(324.9 / 343, 9);
    expect(c.sizeGroups).toEqual([
      {
        templateId: 'sub_pop',
        font: 'Inter-SemiBold',
        fullSizePx: 343,
        cards: 3,
        shrunkCards: 1,
        smallestFactor: 324.9 / 343,
      },
    ]);
  });

  /*
   * A Latin keyword is set at the emphasis ratio rather than at the template's
   * own size, so one authored number per template would read every keyword as
   * enlarged. Grouping by face keeps the two apart.
   */
  it('keeps each face’s own full size', () => {
    const c = shape([
      card('g001', 343),
      textComp('k001__kw_slam', [
        textLayer('TXT_MAIN', 'filler glow', {
          fontSize: 494.742,
          font: 'CormorantGaramondItalic-SemiBoldItalic',
        }),
      ]),
    ], {
      templates: [
        template(),
        template({ id: 'kw_slam', type: 'keyword', shadowLayers: [] }),
      ],
    });
    expect(c.summary.cardsShrunk).toBe(0);
    expect(c.sizeGroups.map((g) => g.fullSizePx).sort((a, b) => a - b)).toEqual([343, 494.742]);
  });

  it('reports nothing shrunk when a set is uniform', () => {
    const c = shape([card('g001', 343), card('g002', 343)]);
    expect(c.summary.cardsShrunk).toBe(0);
    expect(c.summary.smallestSizeFactor).toBeNull();
  });

  it('catches a shadow left at full size behind a shrunk word', () => {
    const c = shape([card('g001', 343), card('g071', 324.9, 343)]);
    expect(c.textComps[1]?.placeholderShadowSameSize).toBe(false);
    expect(c.summary.compsWherePlaceholderAndShadowSizesDiffer).toBe(1);
  });

  it('is satisfied when both layers moved together', () => {
    const c = shape([card('g001', 343), card('g071', 324.9, 324.9)]);
    expect(c.summary.compsWherePlaceholderAndShadowSizesDiffer).toBe(0);
  });
});

describe('the plan comparison', () => {
  const comps = [
    textComp('g001__sub_pop', [
      textLayer('TXT_MAIN', 'dernière'),
      textLayer('TXT_MAIN_SHADOW', 'dernière', { index: 2 }),
    ]),
  ];

  it('is left unmade rather than passed when no plan is supplied', () => {
    const c = shape(comps);
    expect(c.summary.textCompsComparedAgainstPlan).toBeNull();
    expect(c.summary.textMismatchesAgainstPlan).toBeNull();
    expect(c.textComps[0]?.textMatchesPlan).toBeNull();
  });

  it('passes a card that reads what the plan says', () => {
    const c = shape(comps, { expectedTexts: { g001: 'dernière' } });
    expect(c.summary.textCompsComparedAgainstPlan).toBe(1);
    expect(c.summary.textMismatchesAgainstPlan).toBe(0);
    expect(c.textComps[0]?.textMatchesPlan).toBe(true);
  });

  it('names a card that does not', () => {
    const c = shape(comps, { expectedTexts: { g001: 'génération' } });
    expect(c.summary.textMismatchesAgainstPlan).toBe(1);
    expect(c.textComps[0]?.expectedText).toBe('génération');
    expect(c.textComps[0]?.textMatchesPlan).toBe(false);
  });

  /* A break character is not a disagreement about which words a card carries. */
  it('normalises a break and repeated spaces before comparing', () => {
    const wrapped = [
      textComp('k001__sub_pop', [textLayer('TXT_MAIN', 'filler\rglow')]),
    ];
    const c = shape(wrapped, { expectedTexts: { k001: 'filler  glow' } });
    expect(c.textComps[0]?.textMatchesPlan).toBe(true);
  });

  it('leaves a card the plan says nothing about uncompared', () => {
    const c = shape(comps, { expectedTexts: { g999: 'x' } });
    expect(c.summary.textCompsComparedAgainstPlan).toBe(0);
    expect(c.summary.textMismatchesAgainstPlan).toBe(0);
  });
});
