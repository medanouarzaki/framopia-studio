import { describe, expect, it } from 'vitest';
import {
  loadMode,
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
      allowedTemplates: { subtitle: ['sub_pop'], keyword: ['kw_slam'], image: ['bad id'] },
      vocabulary: 'nope',
    });
    expect(paths(issues)).toEqual([
      'id',
      'name',
      'version',
      'palette.primary',
      'imageStyle.negativePrompt',
      'allowedTemplates.image[0]',
      'vocabulary',
    ]);
  });

  it('does not require imageVariation, which is a deliberate gap', () => {
    expect(validateMode(valid())).toEqual([]);
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
