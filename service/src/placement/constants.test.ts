import { describe, expect, it } from 'vitest';
import {
  ARABIC_SIZE_RATIO,
  KEYWORD_FONT_SIZE,
  LINE_SPACING,
  MAX_SUBTITLE_LINES,
  SUBTITLE_ANCHOR_BASELINE_Y,
  inkExtent,
} from '@framopia/core';
import {
  FRAME_HEIGHT,
  SUBTITLE_BAND,
  SUBTITLE_BAND_BOTTOM_PX,
  SUBTITLE_BAND_TOP_PX,
} from './constants.js';

describe('SUBTITLE_BAND', () => {
  it('lands on the values derived from the measured anchor and font metrics', () => {
    expect(SUBTITLE_BAND_TOP_PX).toBeCloseTo(1980.175, 3);
    expect(SUBTITLE_BAND_BOTTOM_PX).toBeCloseTo(2997.5783, 3);
    expect(SUBTITLE_BAND.y).toBeCloseTo(0.5156705729, 9);
    expect(SUBTITLE_BAND.h).toBeCloseTo(0.2649487630, 9);
  });

  it('clears a two-line keyword in the taller face, top and bottom', () => {
    const arabic = inkExtent('arabic', KEYWORD_FONT_SIZE * ARABIC_SIZE_RATIO);
    const firstLineTop = SUBTITLE_ANCHOR_BASELINE_Y - arabic.ascentPx;
    const lastLineBottom =
      SUBTITLE_ANCHOR_BASELINE_Y + (MAX_SUBTITLE_LINES - 1) * LINE_SPACING + arabic.descentPx;
    expect(SUBTITLE_BAND_TOP_PX).toBeLessThanOrEqual(firstLineTop);
    expect(SUBTITLE_BAND_BOTTOM_PX).toBeGreaterThanOrEqual(lastLineBottom);
  });

  it('contains the baseline it is built from', () => {
    expect(SUBTITLE_BAND_TOP_PX).toBeLessThan(SUBTITLE_ANCHOR_BASELINE_Y);
    expect(SUBTITLE_BAND_BOTTOM_PX).toBeGreaterThan(SUBTITLE_ANCHOR_BASELINE_Y);
  });

  it('stays inside the frame and spans its full width', () => {
    expect(SUBTITLE_BAND.x).toBe(0);
    expect(SUBTITLE_BAND.w).toBe(1);
    expect(SUBTITLE_BAND.y).toBeGreaterThan(0);
    expect(SUBTITLE_BAND.y + SUBTITLE_BAND.h).toBeLessThan(1);
    expect(SUBTITLE_BAND.h * FRAME_HEIGHT).toBeCloseTo(
      SUBTITLE_BAND_BOTTOM_PX - SUBTITLE_BAND_TOP_PX,
      9,
    );
  });

  it('is not the provisional band it replaced', () => {
    // 0.671875..0.828125, centred at 0.75. Kept as a test so a revert to the
    // guess cannot pass silently.
    expect(SUBTITLE_BAND.y).not.toBeCloseTo(0.671875, 4);
    expect(SUBTITLE_BAND.y + SUBTITLE_BAND.h).not.toBeCloseTo(0.828125, 4);
  });
});
