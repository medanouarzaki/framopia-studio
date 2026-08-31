import { describe, it, expect } from 'vitest';
import {
  STILL_EXTENSIONS_THE_PANEL_CAN_SHOW,
  STILL_EXTENSIONS_WITHOUT_DOT,
  judgeStill,
  stillVerdictSentence,
} from './still-formats.js';

describe('what a still image the client supplies may be', () => {
  it('a PNG is the intended case and passes silently', () => {
    expect(judgeStill('/x/logo.png')).toEqual({ kind: 'ok' });
    expect(stillVerdictSentence({ kind: 'ok' })).toBeNull();
  });

  it('an empty field says nothing, because it is optional', () => {
    expect(judgeStill('')).toEqual({ kind: 'empty' });
    expect(judgeStill('   ')).toEqual({ kind: 'empty' });
  });

  it('refuses a file that is not a still image, naming the extension', () => {
    expect(judgeStill('/x/brand.mov')).toEqual({ kind: 'unusable', extension: 'mov' });
    const said = stillVerdictSentence({ kind: 'unusable', extension: 'mov' }) ?? '';
    expect(said).toContain('.mov cannot be used as a logo');
    expect(said).toContain('png');
  });

  /**
   * A `.psd` is a legitimate logo under the ruling and the panel still cannot
   * draw one — the only consumer of `logoPath` today is the client card's
   * `<img>`. Saying which of the two it is beats a broken image.
   */
  it('accepts a format it cannot preview, and says that is what happened', () => {
    expect(judgeStill('/x/brand.psd')).toEqual({ kind: 'not-previewable', extension: 'psd' });
    const said = stillVerdictSentence({ kind: 'not-previewable', extension: 'psd' }) ?? '';
    expect(said).toContain('works');
    expect(said).toContain('cannot show you a preview');
  });

  it('ignores case and a path with dots in its directories', () => {
    expect(judgeStill('/x.y/z/LOGO.PNG')).toEqual({ kind: 'ok' });
    expect(judgeStill('/x.y/z/noextension')).toEqual({ kind: 'unusable', extension: '' });
  });

  it('names the file the way the screen asking for it does', () => {
    const said = stillVerdictSentence({ kind: 'unusable', extension: 'mov' }, 'photo') ?? '';
    expect(said).toContain('.mov cannot be used as a photo');
  });

  it('everything the panel can show is something the field accepts', () => {
    for (const ext of STILL_EXTENSIONS_THE_PANEL_CAN_SHOW) {
      expect(STILL_EXTENSIONS_WITHOUT_DOT as readonly string[]).toContain(ext);
    }
  });
});
