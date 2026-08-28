import { describe, expect, it } from 'vitest';
import {
  cardFrameColour, contrastRatio, MIN_IMAGE_EDGE_CONTRAST,
  parseHexColour, relativeLuminance, toAeColour,
} from './image-border.js';

const K2 = {
  background: parseHexColour('#1A0000'),
  primary: parseHexColour('#820000'),
  accent: parseHexColour('#C9A96E'),
  light: parseHexColour('#F8F6F2'),
};

describe('the card frame colour', () => {
  it('agrees with the sRGB definition at both ends', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 6);
    expect(contrastRatio(1, 0)).toBeCloseTo(21, 6);
    expect(contrastRatio(0.3, 0.3)).toBe(1);
  });

  /* Every candidate in the corpus measures 0.0019–0.0266 at its edge. */
  it('frames a dark picture in light, which is the corpus', () => {
    for (const edge of [0.0019, 0.0083, 0.0266]) {
      const frame = cardFrameColour({ edgeLuminance: edge, palette: K2 });
      expect(frame.role).toBe('light');
      expect(frame.meetsMinimum).toBe(true);
      expect(frame.contrast).toBeGreaterThan(12);
    }
  });

  /* The symptom: the frame the reel was built with was invisible on all ten. */
  it('rejects the frame that made the images disappear', () => {
    const dark = contrastRatio(relativeLuminance(K2.background), 0.0083);
    expect(dark).toBeLessThan(MIN_IMAGE_EDGE_CONTRAST);
  });

  it('frames a light picture in dark, without the rule being restated', () => {
    const frame = cardFrameColour({ edgeLuminance: 0.9, palette: K2 });
    expect(frame.role).toBe('background');
    expect(frame.meetsMinimum).toBe(true);
  });

  /* A mid-tone edge is the case neither extreme wins outright. */
  it('lets a mid-tone role win where it separates best', () => {
    const frame = cardFrameColour({
      edgeLuminance: 0.45,
      palette: { accent: K2.accent, background: K2.background },
    });
    expect(frame.role).toBe('background');
    expect(frame.contrast).toBeGreaterThan(
      contrastRatio(relativeLuminance(K2.accent), 0.45),
    );
  });

  it('still frames when nothing separates enough, and says so', () => {
    const frame = cardFrameColour({
      edgeLuminance: 0.2,
      palette: { a: { r: 120, g: 120, b: 120 }, b: { r: 130, g: 130, b: 130 } },
    });
    expect(frame.meetsMinimum).toBe(false);
    expect(frame.role).toBe('b');
  });

  it('breaks a tie by role name rather than by key order', () => {
    const grey = { r: 128, g: 128, b: 128 };
    expect(cardFrameColour({ edgeLuminance: 0.5, palette: { zed: grey, alpha: grey } }).role)
      .toBe('alpha');
  });

  it('reads and writes the two colour formats either side of it', () => {
    expect(parseHexColour('#F8F6F2')).toEqual({ r: 248, g: 246, b: 242 });
    expect(() => parseHexColour('F8F6F2')).toThrow();
    expect(toAeColour({ r: 255, g: 0, b: 51 })).toEqual([1, 0, 0.2]);
  });

  it('refuses an empty palette rather than inventing a frame', () => {
    expect(() => cardFrameColour({ edgeLuminance: 0.1, palette: {} })).toThrow(/palette/);
  });
});
