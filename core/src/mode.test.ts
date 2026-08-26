import { describe, expect, it } from 'vitest';
import {
  checkSlotIdea,
  compositionContentHash,
  MULTI_SUBJECT_MARKERS,
  GLOBAL_NEGATIVE_PROMPTS,
  keywordModeContentHash,
  loadMode,
  slotModeContentHash,
  ModeFontsUnresolvedError,
  ModeValidationError,
  parseMode,
  renderNegativePrompt,
  renderStylePrompt,
  requireFonts,
  validateMode,
  type ClientMode,
} from './mode.js';

const valid = (): Record<string, unknown> => ({
  id: 'k2-syndicalia',
  name: 'K2 Syndicalia',
  version: 1,
  palette: {
    background: '#1A0000',
    primary: '#820000',
    accent: '#C9A96E',
    light: '#F8F6F2',
  },
  fonts: { status: 'tbd', note: 'collected at Block 9' },
  imageStyle: {
    stylePrompt: ['a single clear idea', 'dominant palette of {{palette.primary}}'],
    negativePrompt: ['no background clutter'],
  },
  imageVariation: {
    note: 'axes vary slot to slot',
    axes: { crop: ['wide', 'close'], lighting: ['hard', 'soft'] },
  },
  allowedTemplates: { subtitle: ['sub_pop'], keyword: ['kw_slam'], image: ['img_float'] },
  vocabulary: [],
});

const paths = (issues: { path: string }[]): string[] => issues.map((i) => i.path);

describe('validateMode', () => {
  it('accepts the shape the k2 stub uses', () => {
    expect(validateMode(valid())).toEqual([]);
  });

  it('names a missing required field by path', () => {
    const mode = valid();
    delete mode.imageStyle;
    const issues = validateMode(mode);
    expect(paths(issues)).toEqual(['imageStyle']);
    expect(issues[0]?.message).toBe('required field is missing');
  });

  it('rejects an unknown color format and says what it wanted', () => {
    const mode = valid();
    (mode.palette as Record<string, string>).primary = 'dark red';
    const issues = validateMode(mode);
    expect(paths(issues)).toEqual(['palette.primary']);
    expect(issues[0]?.message).toBe('unknown color format "dark red"; expected uppercase #RRGGBB');
  });

  it('rejects a three-digit hex, which reads as valid CSS but is not the format', () => {
    const mode = valid();
    (mode.palette as Record<string, string>).accent = '#C96';
    expect(paths(validateMode(mode))).toEqual(['palette.accent']);
  });

  it('rejects a template id that breaks the naming convention', () => {
    const mode = valid();
    (mode.allowedTemplates as Record<string, string[]>).image = ['Img Slide Left'];
    const issues = validateMode(mode);
    expect(paths(issues)).toEqual(['allowedTemplates.image[0]']);
    expect(issues[0]?.message).toContain('lowercase type_style');
  });

  it('rejects a well-formed template id carrying the wrong element prefix', () => {
    const mode = valid();
    (mode.allowedTemplates as Record<string, string[]>).keyword = ['sub_pop'];
    const issues = validateMode(mode);
    expect(paths(issues)).toEqual(['allowedTemplates.keyword[0]']);
    expect(issues[0]?.message).toContain('must start with "kw_"');
  });

  it('rejects a style fragment that hardcodes a colour', () => {
    const mode = valid();
    (mode.imageStyle as { stylePrompt: string[] }).stylePrompt = ['deep red #820000 background'];
    const issues = validateMode(mode);
    expect(paths(issues)).toEqual(['imageStyle.stylePrompt[0]']);
    expect(issues[0]?.message).toContain('{{palette.<role>}}');
  });

  it('rejects a style fragment referencing a palette role that does not exist', () => {
    const mode = valid();
    (mode.imageStyle as { stylePrompt: string[] }).stylePrompt = ['{{palette.secondary}}'];
    expect(paths(validateMode(mode))).toEqual(['imageStyle.stylePrompt[0]']);
  });

  it('rejects an unknown fonts status', () => {
    const mode = valid();
    mode.fonts = { status: 'maybe' };
    const issues = validateMode(mode);
    expect(paths(issues)).toEqual(['fonts.status']);
    expect(issues[0]?.message).toBe('expected "tbd" or "set", found "maybe"');
  });

  it('reports every problem in a deliberately broken mode at once', () => {
    const issues = validateMode({
      id: 'K2 Syndicalia',
      version: 0,
      palette: { background: '#1A0000', primary: 'red', accent: '#C9A96E', light: '#F8F6F2' },
      fonts: { status: 'tbd', note: 'x' },
      imageStyle: { stylePrompt: ['ok'], negativePrompt: [] },
      imageVariation: { note: 'x', axes: { crop: ['wide', 'wide'] } },
      allowedTemplates: { subtitle: ['sub_pop'], keyword: ['kw_slam'], image: ['bad id'] },
      vocabulary: 'nope',
    });
    expect(paths(issues)).toEqual([
      'id',
      'name',
      'version',
      'palette.primary',
      'imageStyle.negativePrompt',
      'imageVariation.axes.crop',
      'allowedTemplates.image[0]',
      'vocabulary',
    ]);
  });

  it('requires imageVariation now that the axes are settled', () => {
    const mode = valid();
    delete mode.imageVariation;
    expect(paths(validateMode(mode))).toEqual(['imageVariation']);
  });

  it('rejects an axis with a single value, which does not vary', () => {
    const mode = valid();
    (mode.imageVariation as { axes: Record<string, string[]> }).axes.crop = ['wide'];
    const issues = validateMode(mode);
    expect(paths(issues)).toEqual(['imageVariation.axes.crop']);
    expect(issues[0]?.message).toContain('does not vary');
  });

  it('rejects duplicate values on an axis', () => {
    const mode = valid();
    (mode.imageVariation as { axes: Record<string, string[]> }).axes.crop = ['wide', 'wide'];
    expect(paths(validateMode(mode))).toEqual(['imageVariation.axes.crop']);
  });

  it('rejects an axis value naming a colour, which belongs to the palette', () => {
    const mode = valid();
    (mode.imageVariation as { axes: Record<string, string[]> }).axes.crop = [
      'wide',
      'close on #820000',
    ];
    expect(paths(validateMode(mode))).toEqual(['imageVariation.axes.crop[1]']);
  });

  it('rejects an axes block with no axes at all', () => {
    const mode = valid();
    (mode.imageVariation as { axes: Record<string, string[]> }).axes = {};
    expect(paths(validateMode(mode))).toEqual(['imageVariation.axes']);
  });
});

describe('parseMode', () => {
  it('throws a listing error naming the file', () => {
    const mode = valid();
    delete mode.palette;
    expect(() => parseMode(JSON.stringify(mode), '/modes/k2-syndicalia.json')).toThrow(
      ModeValidationError,
    );
  });

  it('rejects an id that disagrees with the filename', () => {
    expect(() => parseMode(JSON.stringify(valid()), '/modes/other.json')).toThrow(
      /must equal the filename stem "other"/,
    );
  });

  it('reports unparseable JSON as a mode problem, not a crash', () => {
    expect(() => parseMode('{oops', '/modes/x.json')).toThrow(/not valid JSON/);
  });
});

describe('the k2 stub on disk', () => {
  const mode = loadMode('k2-syndicalia');

  it('carries the four locked colours', () => {
    expect(mode.palette).toEqual({
      background: '#1A0000',
      primary: '#820000',
      accent: '#C9A96E',
      light: '#F8F6F2',
    });
  });

  it('still has fonts marked TBD', () => {
    expect(mode.fonts.status).toBe('tbd');
  });

  it('has no vocabulary yet', () => {
    expect(mode.vocabulary).toEqual([]);
  });

  // v6, Block 6 session 7: the two Arabic template variants were added to
  // allowedTemplates once the comps existed. The bump invalidates the
  // image-generation cache, which keys on modeVersion, and nothing else.
  it('is at version 6', () => {
    expect(mode.version).toBe(6);
  });

  it('allows both script variants of the text templates', () => {
    expect(mode.allowedTemplates.subtitle).toEqual(['sub_pop', 'sub_pop_ar']);
    expect(mode.allowedTemplates.keyword).toEqual(['kw_slam', 'kw_slam_ar']);
  });

  // §5.4's candidate default dropped from 3 to 2 at Block 4 session 5:
  // pro bills ~$0.151 per 2K image, so three on a five-slot reel is $2.26
  // against PROJECT_SPEC's $2.00 envelope.
  it('overrides the candidate count to two', () => {
    expect(mode.imageCandidates).toBe(2);
  });

  // A cutout needs the subject separated from its ground.
  it('has no flat or unmodelled lighting entry', () => {
    for (const value of mode.imageVariation.axes.lighting ?? []) {
      const lower = value.toLowerCase();
      expect(lower).not.toContain('flat');
      expect(lower).not.toContain('no modelling');
      // Session 5's ruling: barely-readable shadows are the flat
      // characterless look under a gentler name. Diffuse and modelled is
      // fine; diffuse and unmodelled is not.
      expect(lower).not.toContain('barely readable');
    }
  });

  it('varies camera angle, framing tightness and lighting across a reel', () => {
    expect(Object.keys(mode.imageVariation.axes).sort()).toEqual([
      'cameraAngle',
      'framingTightness',
      'lighting',
    ]);
  });

  /**
   * A cutout discards the background, so variation expressed as where the
   * subject sits inside the generated frame is erased and the set reads as
   * batched exactly where cutouts work best. Every axis term has to be a
   * property of the subject itself.
   */
  it('has no in-frame placement language in any axis', () => {
    const placement = [
      'off-centre', 'off centre', 'in frame', 'to one side', 'edge to edge',
      'headroom', 'symmetrical',
    ];
    for (const [axis, values] of Object.entries(mode.imageVariation.axes)) {
      for (const value of values) {
        for (const term of placement) {
          expect(`${axis}: ${value}`.toLowerCase()).not.toContain(term);
        }
      }
    }
  });

  // Centred survives the cutout and helps it, by keeping the subject clear
  // of the frame edge, so the invariant fragment keeps it.
  it('keeps the centred subject in the invariant half', () => {
    expect(mode.imageStyle.stylePrompt.join(' ')).toContain('centred and unobstructed');
  });

  it('has no contradiction between its two halves', () => {
    expect(validateMode(mode as unknown as Record<string, unknown>)).toEqual([]);
  });
});

describe('validateMode — the two halves of a prompt must agree', () => {
  /**
   * The exact pair that shipped in Block 4 session 2's prompt and was found
   * by a human reading the composed string after the image came back.
   */
  it('rejects an axis term that contradicts the invariant fragment', () => {
    const mode = valid();
    (mode.imageStyle as { stylePrompt: string[] }).stylePrompt = [
      'one subject, centred and unobstructed',
    ];
    (mode.imageVariation as { axes: Record<string, string[]> }).axes = {
      cameraAngle: ['seen straight on', 'subject off-centre with open space to one side'],
    };
    const issues = validateMode(mode);
    expect(paths(issues)).toEqual(['imageVariation.axes.cameraAngle[1]']);
    expect(issues[0]?.message).toContain('centred');
  });

  it('reports every contradicting axis term, not just the first', () => {
    const mode = valid();
    (mode.imageStyle as { stylePrompt: string[] }).stylePrompt = [
      'one subject, centred and unobstructed',
    ];
    (mode.imageVariation as { axes: Record<string, string[]> }).axes = {
      a: ['off-centre framing', 'subject partially hidden'],
    };
    expect(paths(validateMode(mode)).sort()).toEqual([
      'imageVariation.axes.a[0]',
      'imageVariation.axes.a[1]',
    ]);
  });

  it('says nothing when the invariant fragment does not carry the term', () => {
    const mode = valid();
    (mode.imageStyle as { stylePrompt: string[] }).stylePrompt = ['a bold graphic treatment'];
    (mode.imageVariation as { axes: Record<string, string[]> }).axes = {
      a: ['subject off-centre with open space to one side', 'seen straight on'],
    };
    expect(validateMode(mode)).toEqual([]);
  });

  it('matches regardless of case', () => {
    const mode = valid();
    (mode.imageStyle as { stylePrompt: string[] }).stylePrompt = ['One Subject, Centred'];
    (mode.imageVariation as { axes: Record<string, string[]> }).axes = {
      a: ['Subject OFF-CENTRE', 'seen straight on'],
    };
    expect(paths(validateMode(mode))).toEqual(['imageVariation.axes.a[0]']);
  });
});

describe('renderStylePrompt', () => {
  it('substitutes palette values so no colour is written in code', () => {
    const mode = parseMode(JSON.stringify(valid()), '/modes/k2-syndicalia.json');
    expect(renderStylePrompt(mode)).toEqual([
      'a single clear idea',
      'dominant palette of #820000',
    ]);
  });

  it('follows the palette when it changes', () => {
    const mode = parseMode(JSON.stringify(valid()), '/modes/k2-syndicalia.json');
    const recoloured: ClientMode = { ...mode, palette: { ...mode.palette, primary: '#00FF00' } };
    expect(renderStylePrompt(recoloured)[1]).toBe('dominant palette of #00FF00');
  });
});

describe('renderNegativePrompt', () => {
  it('appends the global negatives without duplicating them', () => {
    const raw = valid();
    (raw.imageStyle as { negativePrompt: string[] }).negativePrompt = [
      'no background clutter',
      'no text',
    ];
    const mode = parseMode(JSON.stringify(raw), '/modes/k2-syndicalia.json');
    expect(renderNegativePrompt(mode)).toEqual([
      'no background clutter',
      'no text',
      'no watermark',
      'no logo',
    ]);
  });
});

describe('requireFonts', () => {
  it('throws for a stage that needs a font while fonts are TBD', () => {
    const mode = parseMode(JSON.stringify(valid()), '/modes/k2-syndicalia.json');
    expect(() => requireFonts(mode, 'build')).toThrow(ModeFontsUnresolvedError);
    expect(() => requireFonts(mode, 'build')).toThrow(/stage "build" requires a real font/);
  });

  it('returns them once they are set', () => {
    const raw = valid();
    raw.fonts = { status: 'set', latin: 'Inter Semi-Bold', arabic: 'Some Arabic Font' };
    const mode = parseMode(JSON.stringify(raw), '/modes/k2-syndicalia.json');
    expect(requireFonts(mode, 'build')).toEqual({
      latin: 'Inter Semi-Bold',
      arabic: 'Some Arabic Font',
    });
  });
});

describe('mode content hashes', () => {
  const mode = loadMode('k2-syndicalia');
  const bump = (o: Partial<ClientMode>): ClientMode => ({ ...mode, ...o }) as ClientMode;

  /**
   * The Block 4 session 3 problem: the mode went v2 to v3 for a
   * variation-axis vocabulary change, and every analysis cache entry was
   * invalidated for an edit the Gemini call never sees. A font landing at
   * Block 9 would do the same. Keying on content rather than version is what
   * stops that.
   */
  it('ignores a version bump on its own', () => {
    const bumped = bump({ version: mode.version + 1 });
    expect(keywordModeContentHash(bumped)).toBe(keywordModeContentHash(mode));
    expect(slotModeContentHash(bumped)).toBe(slotModeContentHash(mode));
  });

  it('ignores a variation-axis edit, which no analysis call reads', () => {
    const edited = bump({
      imageVariation: {
        ...mode.imageVariation,
        axes: { ...mode.imageVariation.axes, lighting: ['a', 'b'] },
      },
    });
    expect(keywordModeContentHash(edited)).toBe(keywordModeContentHash(mode));
    expect(slotModeContentHash(edited)).toBe(slotModeContentHash(mode));
  });

  it('ignores fonts, which arrive at Block 9 and reach no prompt', () => {
    const fonted = bump({ fonts: { status: 'set', latin: 'Inter', arabic: 'Cairo' } });
    expect(keywordModeContentHash(fonted)).toBe(keywordModeContentHash(mode));
    expect(slotModeContentHash(fonted)).toBe(slotModeContentHash(mode));
  });

  it('changes when the client name changes, which both prompts carry', () => {
    const renamed = bump({ name: 'Another Client' });
    expect(keywordModeContentHash(renamed)).not.toBe(keywordModeContentHash(mode));
    expect(slotModeContentHash(renamed)).not.toBe(slotModeContentHash(mode));
  });

  // The keyword prompt passes vocabulary as an explicit term list; the slot
  // prompt never sees it, so keying slots on it would re-run every slot when
  // Block 9 fills the vocabulary in.
  it('changes the keyword hash on vocabulary but not the slot hash', () => {
    const stocked = bump({ vocabulary: ['profhilo', 'RRS eyes'] });
    expect(keywordModeContentHash(stocked)).not.toBe(keywordModeContentHash(mode));
    expect(slotModeContentHash(stocked)).toBe(slotModeContentHash(mode));
  });

  it('is 16 hex characters and stable', () => {
    expect(keywordModeContentHash(mode)).toMatch(/^[0-9a-f]{16}$/);
    expect(keywordModeContentHash(mode)).toBe(keywordModeContentHash(mode));
  });
});

describe('compositionContentHash', () => {
  const mode = loadMode('k2-syndicalia');

  it('changes on a variation-axis edit, which composition does read', () => {
    const edited = {
      ...mode,
      imageVariation: {
        ...mode.imageVariation,
        axes: { ...mode.imageVariation.axes, lighting: ['a', 'b'] },
      },
    } as ClientMode;
    expect(compositionContentHash(edited)).not.toBe(compositionContentHash(mode));
  });

  it('changes on a palette edit, which is substituted into the fragments', () => {
    const repainted = {
      ...mode, palette: { ...mode.palette, accent: '#000000' },
    } as ClientMode;
    expect(compositionContentHash(repainted)).not.toBe(compositionContentHash(mode));
  });

  it('ignores a bare version bump', () => {
    expect(compositionContentHash({ ...mode, version: 99 } as ClientMode)).toBe(
      compositionContentHash(mode),
    );
  });
});

describe('GLOBAL_NEGATIVE_PROMPTS', () => {
  /**
   * `no text` was removed at Block 4 session 5. It never worked as a control
   * — one corpus image rendered a legible product label straight through it —
   * and what was being guarded against was uncontrolled labelling, which is
   * now checked after the fact by a check that can actually fail.
   */
  it('no longer forbids text', () => {
    expect(GLOBAL_NEGATIVE_PROMPTS).not.toContain('no text');
  });

  it('still forbids watermarks and logos', () => {
    expect(GLOBAL_NEGATIVE_PROMPTS).toContain('no watermark');
    expect(GLOBAL_NEGATIVE_PROMPTS).toContain('no logo');
  });
});

describe('validateMode — imageCandidates', () => {
  it('accepts 2 to 4, and absence', () => {
    for (const n of [undefined, 2, 3, 4]) {
      const mode = valid();
      if (n !== undefined) mode.imageCandidates = n;
      expect(validateMode(mode)).toEqual([]);
    }
  });

  it('rejects a count outside the §5.4 band', () => {
    for (const n of [0, 1, 5, 2.5, 'two']) {
      const mode = valid();
      mode.imageCandidates = n;
      expect(paths(validateMode(mode))).toEqual(['imageCandidates']);
    }
  });
});

describe('checkSlotIdea', () => {
  const mode = loadMode('k2-syndicalia');

  it('passes a single-subject idea', () => {
    for (const idea of [
      'A cosmetic bottle of hair serum on a presentation podium',
      'A clock face showing exactly five minutes',
      'A woman looking at a mirror touching her hair with a thoughtful expression',
      'A female doctor in a medical coat holding a small vial.',
    ]) {
      expect(checkSlotIdea('s', idea, mode)).toEqual([]);
    }
  });

  /**
   * The idea that produced three separate problems on img005: an edge-noise
   * failure the gate reported as a matte defect, 47 invented label words, and
   * an unusable matte.
   */
  it('flags the shelf idea, naming every marker', () => {
    const issues = checkSlotIdea('img005', 'A salon shelf displaying premium hair care products', mode);
    expect(issues.map((i) => i.marker).sort()).toEqual(['display', 'products', 'shelf']);
    expect(issues[0]?.slotId).toBe('img005');
  });

  it('flags plural product nouns', () => {
    expect(checkSlotIdea('s', 'Vitamin capsules blending into a cream', mode)).toHaveLength(1);
    expect(checkSlotIdea('s', 'Three bottles on a table', mode)).toHaveLength(1);
  });

  // Singular is the whole point: one vial is one subject.
  it('does not flag the singular', () => {
    expect(checkSlotIdea('s', 'A doctor holding a small vial', mode)).toEqual([]);
    expect(checkSlotIdea('s', 'A single bottle', mode)).toEqual([]);
  });

  it('says the planner must change, not the idea', () => {
    const issues = checkSlotIdea('s', 'A shelf of serums', mode);
    expect(issues[0]?.message).toMatch(/not rewritten here/);
  });

  it('is case-insensitive', () => {
    expect(checkSlotIdea('s', 'A SALON SHELF', mode)).toHaveLength(1);
  });

  /**
   * A mode whose style fragments never ask for one subject has not made the
   * claim, and this must not invent it for them.
   */
  it('says nothing when the mode does not ask for one subject', () => {
    const permissive = {
      ...mode,
      imageStyle: { ...mode.imageStyle, stylePrompt: ['a bold graphic treatment'] },
    } as ClientMode;
    expect(checkSlotIdea('s', 'A salon shelf of products', permissive)).toEqual([]);
  });

  it('carries a reason for every marker', () => {
    for (const marker of MULTI_SUBJECT_MARKERS) {
      expect(marker.why.length).toBeGreaterThan(10);
    }
  });
});
