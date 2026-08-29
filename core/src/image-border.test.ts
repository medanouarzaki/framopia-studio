import { describe, expect, it } from 'vitest';
import {
  cardColours, cardFrameColour, contrastRatio, frameReferenceLuminance,
  MIN_IMAGE_EDGE_CONTRAST, parseHexColour, relativeLuminance, toAeColour,
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

/**
 * Session 25 measured the **raw generated picture's** outer ring for every
 * candidate. Every raw picture is dark, because every prompt carries the mode's
 * dark palette, so it always chose a light frame — and for a cut-out it was
 * measuring a picture that is not the one on screen. A cut-out's ring is
 * transparent; dropping the alpha channel makes it black; the light frame it
 * then chose is exactly what the subject disappeared into.
 */
describe('which measurement the frame is chosen against', () => {
  it('uses the picture’s own edge when the whole picture is shown', () => {
    const ref = frameReferenceLuminance({
      rendersAsCutout: false,
      edgeLuminance: 0.0266,
      subjectLitLuminance: 0.5,
    });
    expect(ref.luminance).toBe(0.0266);
    expect(ref.measured).toContain('edge');
  });

  it('uses the lit part of the subject for a cut-out', () => {
    const ref = frameReferenceLuminance({
      rendersAsCutout: true,
      edgeLuminance: 0,
      subjectLitLuminance: 0.464,
    });
    expect(ref.luminance).toBe(0.464);
    expect(ref.measured).toContain('subject');
  });

  /* A cut-out with nothing opaque in it has no subject to judge. */
  it('falls back to the edge when there is no subject', () => {
    expect(
      frameReferenceLuminance({
        rendersAsCutout: true,
        edgeLuminance: 0.02,
        subjectLitLuminance: null,
      }).luminance,
    ).toBe(0.02);
  });

  /* `vitasilk` `img002-c1`, the one the user was looking at. */
  it('turns the frame dark for the cut-out that was disappearing', () => {
    const K2 = {
      background: parseHexColour('#1A0000'),
      primary: parseHexColour('#820000'),
      accent: parseHexColour('#C9A96E'),
      light: parseHexColour('#F8F6F2'),
    };
    const before = cardFrameColour({ edgeLuminance: 0, palette: K2 });
    expect(before.role).toBe('light');
    const ref = frameReferenceLuminance({
      rendersAsCutout: true,
      edgeLuminance: 0,
      subjectLitLuminance: 0.464,
    });
    const after = cardFrameColour({ edgeLuminance: ref.luminance, palette: K2 });
    expect(after.role).toBe('background');
    expect(after.contrast).toBeGreaterThan(MIN_IMAGE_EDGE_CONTRAST);
    // What the old choice was really worth against what is on screen.
    expect(contrastRatio(relativeLuminance(K2.light), 0.464)).toBeLessThan(2);
  });
});

/**
 * `img_float` has two layers: the picture, and a card behind it showing as a
 * 40 px border. For a whole picture the border sits against the picture and one
 * colour is enough. **For a cut-out the picture is transparent**, so the card
 * shows through the whole square, the frame and the fill become one layer, and
 * the border cannot be seen — which is what the user saw beside four slots that
 * had a clear white frame.
 */
describe('the two colours a framed picture needs', () => {
  const K2 = {
    background: parseHexColour('#1A0000'),
    primary: parseHexColour('#820000'),
    accent: parseHexColour('#C9A96E'),
    light: parseHexColour('#F8F6F2'),
  };

  it('gives a whole picture one colour, because it is its own fill', () => {
    const c = cardColours({
      rendersAsCutout: false,
      edgeLuminance: 0.0066,
      subjectLitLuminance: 0.5,
      palette: K2,
    });
    expect(c.fill).toBeNull();
    expect(c.frame.role).toBe('light');
    expect(c.meetsMinimum).toBe(true);
  });

  /* `vitasilk` `img002-c1`, the picture with no border. */
  it('gives a cut-out a ground of its own, and a frame against that ground', () => {
    const c = cardColours({
      rendersAsCutout: true,
      edgeLuminance: 0,
      subjectLitLuminance: 0.464,
      palette: K2,
    });
    expect(c.fill?.role).toBe('background');
    expect(c.frame.role).toBe('light');
    expect(c.fill?.contrast).toBeGreaterThan(MIN_IMAGE_EDGE_CONTRAST);
    expect(c.frame.contrast).toBeGreaterThan(MIN_IMAGE_EDGE_CONTRAST);
    expect(c.meetsMinimum).toBe(true);
  });

  /* A dark subject wants the opposite pair, which is the rule being per-image. */
  it('turns the pair around for a dark subject', () => {
    const c = cardColours({
      rendersAsCutout: true,
      edgeLuminance: 0,
      subjectLitLuminance: 0.0389,
      palette: K2,
    });
    expect(c.fill?.role).toBe('light');
    expect(c.frame.role).toBe('background');
  });

  it('never gives the frame the same colour as the fill', () => {
    for (const subject of [0, 0.05, 0.2, 0.464, 0.7, 0.95, 1]) {
      const c = cardColours({
        rendersAsCutout: true,
        edgeLuminance: 0,
        subjectLitLuminance: subject,
        palette: K2,
      });
      expect(c.fill?.role, String(subject)).not.toBe(c.frame.role);
    }
  });

  /*
   * Maximising the smaller of the two: a design with one comfortable contrast
   * and one that fails is a design that fails.
   */
  it('maximises the worse of the two contrasts, not their sum', () => {
    const c = cardColours({
      rendersAsCutout: true,
      edgeLuminance: 0,
      subjectLitLuminance: 0.464,
      palette: K2,
    });
    // background + accent would give the border 8.99 where light gives 18.64;
    // both clear the minimum, so the larger worse-case wins.
    expect(Math.min(c.fill?.contrast ?? 0, c.frame.contrast)).toBeCloseTo(9.85, 1);
  });

  it('says so, and does not settle quietly, when no pair reaches the minimum', () => {
    const flat = { a: { r: 120, g: 120, b: 120 }, b: { r: 130, g: 130, b: 130 } };
    const c = cardColours({
      rendersAsCutout: true,
      edgeLuminance: 0,
      subjectLitLuminance: 0.2,
      palette: flat,
    });
    expect(c.meetsMinimum).toBe(false);
    expect(c.fallback).toContain('best available');
    // It still returns a pair: a build with no colours is worse than a build
    // with the closest ones.
    expect(c.fill).not.toBeNull();
  });

  it('refuses a palette that cannot supply two colours', () => {
    expect(() =>
      cardColours({
        rendersAsCutout: true,
        edgeLuminance: 0,
        subjectLitLuminance: 0.4,
        palette: { only: { r: 0, g: 0, b: 0 } },
      }),
    ).toThrow(/two colours/);
  });
});
