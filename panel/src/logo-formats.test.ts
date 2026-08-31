import { describe, it, expect } from 'vitest';
import {
  LOGO_EXTENSIONS_THE_PANEL_CAN_SHOW,
  LOGO_EXTENSIONS_WITHOUT_DOT,
  judgeLogo,
  logoVerdictSentence,
} from './logo-formats.js';

describe('what a logo may be', () => {
  it('a PNG is the intended case and passes silently', () => {
    expect(judgeLogo('/x/logo.png')).toEqual({ kind: 'ok' });
    expect(logoVerdictSentence({ kind: 'ok' })).toBeNull();
  });

  it('an empty field says nothing, because it is optional', () => {
    expect(judgeLogo('')).toEqual({ kind: 'empty' });
    expect(judgeLogo('   ')).toEqual({ kind: 'empty' });
  });

  it('refuses a file that is not a still image, naming the extension', () => {
    expect(judgeLogo('/x/brand.mov')).toEqual({ kind: 'unusable', extension: 'mov' });
    const said = logoVerdictSentence({ kind: 'unusable', extension: 'mov' }) ?? '';
    expect(said).toContain('.mov cannot be used');
    expect(said).toContain('png');
  });

  /**
   * A `.psd` is a legitimate logo under the ruling and the panel still cannot
   * draw one — the only consumer of `logoPath` today is the client card's
   * `<img>`. Saying which of the two it is beats a broken image.
   */
  it('accepts a format it cannot preview, and says that is what happened', () => {
    expect(judgeLogo('/x/brand.psd')).toEqual({ kind: 'not-previewable', extension: 'psd' });
    const said = logoVerdictSentence({ kind: 'not-previewable', extension: 'psd' }) ?? '';
    expect(said).toContain('works');
    expect(said).toContain('cannot show you a preview');
  });

  it('ignores case and a path with dots in its directories', () => {
    expect(judgeLogo('/x.y/z/LOGO.PNG')).toEqual({ kind: 'ok' });
    expect(judgeLogo('/x.y/z/noextension')).toEqual({ kind: 'unusable', extension: '' });
  });

  it('everything the panel can show is something the field accepts', () => {
    for (const ext of LOGO_EXTENSIONS_THE_PANEL_CAN_SHOW) {
      expect(LOGO_EXTENSIONS_WITHOUT_DOT as readonly string[]).toContain(ext);
    }
  });
});
