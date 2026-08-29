import { describe, expect, it } from 'vitest';
import { clientDefaults, STANDARD_FONTS } from './client-defaults.js';
import { loadMode, validateMode } from './mode.js';
import { ARABIC_FONT, LATIN_FONT, SUBTITLE_ANCHOR_BASELINE_Y } from './typography.js';

/*
 * A client detail that changed what an existing client builds would be a
 * defect, not a feature. Every default is the value in force before the field
 * existed, and `k2-syndicalia` is the client that proves it.
 */
describe('what a client who says nothing gets', () => {
  it('is what the tool already did', () => {
    const d = clientDefaults({});
    expect(d).toMatchObject({
      language: 'mixed',
      videoShape: 'vertical',
      watermark: true,
      subtitleBaselineY: SUBTITLE_ANCHOR_BASELINE_Y,
    });
    expect(d.source).toEqual({
      language: 'standard',
      videoShape: 'standard',
      watermark: 'standard',
      subtitleBaselineY: 'standard',
    });
    expect(STANDARD_FONTS).toEqual({ latin: LATIN_FONT, arabic: ARABIC_FONT });
  });

  it('says which values the client chose and which are the standard ones', () => {
    const d = clientDefaults({ language: 'french', watermarkByDefault: false });
    expect(d.language).toBe('french');
    expect(d.watermark).toBe(false);
    expect(d.source.language).toBe('client');
    expect(d.source.watermark).toBe('client');
    expect(d.source.videoShape).toBe('standard');
  });

  it('leaves k2-syndicalia exactly as it was', () => {
    const mode = loadMode('k2-syndicalia');
    expect(validateMode(mode)).toEqual([]);
    expect(mode.version).toBe(7);
    // None of the new fields is set, so every one of them takes the old value.
    const d = clientDefaults(mode);
    expect(d.source).toEqual({
      language: 'standard',
      videoShape: 'standard',
      watermark: 'standard',
      subtitleBaselineY: 'standard',
    });
    expect(mode.videoFolder).toBeUndefined();
    expect(mode.pictures).toBeUndefined();
  });
});
