import { describe, expect, it } from 'vitest';
import { canvasScalePercent, contentAnchorPoint, contentAwareScalePercent, type ContentBox } from './content-box.js';

const full: ContentBox = { canvasW: 2048, canvasH: 2048, x: 0, y: 0, w: 2048, h: 2048 };
const half: ContentBox = { canvasW: 2048, canvasH: 2048, x: 512, y: 512, w: 1024, h: 1024 };
// vitasilk img002-c1: a tall narrow subject, the worst case in the corpus.
const tall: ContentBox = { canvasW: 2048, canvasH: 2048, x: 764, y: 203, w: 520, h: 1394 };

const base = { auditedSolidWidth: 1000, auditedScalePercent: 100, sourceWidth: 2048 };

describe('contentAwareScalePercent', () => {
  it('is unchanged when the content already fills the canvas', () => {
    expect(contentAwareScalePercent({ ...base, content: full })).toBeCloseTo(48.828125, 6);
  });

  it('matches the canvas rule exactly when no content box is known', () => {
    expect(contentAwareScalePercent({ ...base, content: undefined })).toBeCloseTo(48.828125, 6);
  });

  it('doubles when the content is half the canvas', () => {
    expect(contentAwareScalePercent({ ...base, content: half })).toBeCloseTo(97.65625, 6);
  });

  it('binds on the long edge, not the short one', () => {
    // 2048/1394, not 2048/520: the long edge is what has to fit.
    expect(contentAwareScalePercent({ ...base, content: tall })).toBeCloseTo(
      48.828125 * (2048 / 1394),
      6,
    );
  });

  it('carries a template that already scales its placeholder', () => {
    expect(
      contentAwareScalePercent({ ...base, auditedScalePercent: 80, content: half }),
    ).toBeCloseTo(78.125, 6);
  });

  it('refuses a source with no width rather than dividing by zero', () => {
    expect(() => contentAwareScalePercent({ ...base, sourceWidth: 0 })).toThrow(/positive/);
  });
});

describe('contentAnchorPoint', () => {
  it('is the canvas centre when the content is centred', () => {
    expect(contentAnchorPoint(full)).toEqual({ x: 1024, y: 1024 });
    expect(contentAnchorPoint(half)).toEqual({ x: 1024, y: 1024 });
  });

  it('follows the content when it sits off centre', () => {
    // 764 + 520/2 = 1024 across, 203 + 1394/2 = 900 down.
    expect(contentAnchorPoint(tall)).toEqual({ x: 1024, y: 900 });
  });

  it('is in source pixels, so it does not depend on the layer scale', () => {
    expect(contentAnchorPoint(tall)).toEqual(contentAnchorPoint({ ...tall }));
  });
});

/*
 * Block 7 session 9. Every image is framed now, and the CARD layer is a fixed
 * 1080 inside a 1200 comp — it does not scale with the picture. A card must
 * therefore be sized by its canvas, which is what the frame contains; sizing it
 * by content spills the picture past the frame on any file whose content fills
 * less than 1000/1080 of its canvas.
 */
describe('a card frame tracks its image', () => {
  const CARD_PX = 1080;
  const SOLID_PX = 1000;
  const rendered = (scalePercent: number, canvas = 2048): number => canvas * (scalePercent / 100);

  const base = { auditedSolidWidth: SOLID_PX, auditedScalePercent: 100, sourceWidth: 2048 };

  it('keeps the picture inside the frame at a content factor that used to overflow', () => {
    // vitasilk img001: content is 0.905 of its canvas.
    const content: ContentBox = { canvasW: 2048, canvasH: 2048, x: 97, y: 99, w: 1854, h: 1850 };
    expect(rendered(contentAwareScalePercent({ ...base, content }))).toBeGreaterThan(CARD_PX);
    expect(rendered(canvasScalePercent(base))).toBeLessThanOrEqual(CARD_PX);
  });

  it('holds at a second, far worse content factor', () => {
    // vitasilk img002: content is 0.681 of its canvas, the corpus's worst.
    const content: ContentBox = { canvasW: 2048, canvasH: 2048, x: 764, y: 203, w: 520, h: 1394 };
    expect(rendered(contentAwareScalePercent({ ...base, content }))).toBeGreaterThan(CARD_PX * 1.3);
    expect(rendered(canvasScalePercent(base))).toBeLessThanOrEqual(CARD_PX);
  });

  it('renders the picture at the solid the frame was built around', () => {
    expect(rendered(canvasScalePercent(base))).toBeCloseTo(SOLID_PX, 6);
  });

  it('leaves the same border whatever the content fraction', () => {
    for (const canvas of [1024, 2048, 4096]) {
      expect(rendered(canvasScalePercent({ ...base, sourceWidth: canvas }), canvas)).toBeCloseTo(
        SOLID_PX,
        6,
      );
    }
  });
});
