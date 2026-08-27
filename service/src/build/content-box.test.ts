import { describe, expect, it } from 'vitest';
import { contentAnchorPoint, contentAwareScalePercent, type ContentBox } from './content-box.js';

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
