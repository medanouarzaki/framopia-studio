import { describe, expect, it } from 'vitest';
import { SUBTITLE_ANCHOR_BASELINE_Y, SUBTITLE_ANCHOR_X } from '@framopia/core';
import { placeholderScalePercent, textCompPosition, auditedSolid, type AuditComp } from './reel-plan.js';

const prop = (v: unknown) => ({ value: v, valueAtSampleTime: v, keyframes: 0, unreadable: null });

const subPop: AuditComp = {
  name: 'sub_pop',
  width: 2160,
  height: 1100,
  layers: [
    {
      name: 'TXT_MAIN',
      kind: 'text',
      position: prop([1080, 700, 0]),
      anchorPoint: prop([0, 0, 0]),
      scale: prop([100, 100, 100]),
    },
  ],
};

const imgFloat = (solidWidth: number, scalePercent = 100): AuditComp => ({
  name: 'img_float',
  width: 1200,
  height: 1200,
  layers: [
    {
      name: 'IMG_MAIN',
      kind: 'solid',
      position: prop([540, 540, 0]),
      anchorPoint: prop([solidWidth / 2, solidWidth / 2, 0]),
      scale: prop([scalePercent, scalePercent, 100]),
      width: solidWidth,
      height: solidWidth,
    },
  ],
});

describe('textCompPosition', () => {
  it('puts the placeholder baseline on the global anchor', () => {
    // anchor y is the comp centre, 550; baseline sits 150 below it, so the
    // layer rides 150 above the target.
    expect(textCompPosition(subPop, 'TXT_MAIN')).toEqual({
      x: SUBTITLE_ANCHOR_X,
      y: SUBTITLE_ANCHOR_BASELINE_Y - 150,
    });
  });

  it('refuses a comp whose placeholder was never audited', () => {
    const stale: AuditComp = { ...subPop, layers: [{ name: 'TXT_MAIN', kind: 'text' }] };
    expect(() => textCompPosition(stale, 'TXT_MAIN')).toThrow(/no audited position/);
  });
});

/*
 * A replaced layer takes the source's dimensions, so the template's 100% is
 * only right for the original solid. Two source sizes, so the derivation is
 * exercised rather than fitted to the one case Block 7 session 3 saw.
 */
describe('placeholderScalePercent', () => {
  it('shrinks a source larger than the solid', () => {
    const c = imgFloat(1000);
    const solid = auditedSolid(c, 'IMG_MAIN');
    expect(
      placeholderScalePercent({
        auditedSolidWidth: solid.width,
        auditedScalePercent: solid.scalePercent,
        sourceWidth: 2048,
      }),
    ).toBeCloseTo(48.828125, 6);
  });

  it('grows a source smaller than the solid', () => {
    const c = imgFloat(1000);
    const solid = auditedSolid(c, 'IMG_MAIN');
    expect(
      placeholderScalePercent({
        auditedSolidWidth: solid.width,
        auditedScalePercent: solid.scalePercent,
        sourceWidth: 512,
      }),
    ).toBeCloseTo(195.3125, 6);
  });

  it('carries a template that already scales its placeholder', () => {
    const c = imgFloat(1000, 80);
    const solid = auditedSolid(c, 'IMG_MAIN');
    expect(solid.scalePercent).toBe(80);
    expect(
      placeholderScalePercent({
        auditedSolidWidth: solid.width,
        auditedScalePercent: solid.scalePercent,
        sourceWidth: 2000,
      }),
    ).toBeCloseTo(40, 6);
  });

  it('is the identity when the source matches the solid', () => {
    expect(
      placeholderScalePercent({ auditedSolidWidth: 1000, auditedScalePercent: 100, sourceWidth: 1000 }),
    ).toBe(100);
  });

  it('refuses a source with no width rather than dividing by zero', () => {
    expect(() =>
      placeholderScalePercent({ auditedSolidWidth: 1000, auditedScalePercent: 100, sourceWidth: 0 }),
    ).toThrow(/positive/);
  });
});
