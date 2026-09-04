import { describe, expect, it } from 'vitest';
import {
  FINAL_FRAME_NAME,
  SAMPLE_FPS,
  parseShowinfo,
  readFramesManifest,
} from './sample.js';
import { videoByLabel } from './footage.js';
import { summarise } from './segment.js';

const TEST_1 = videoByLabel('test-1');

const SHOWINFO = `[Parsed_showinfo_2 @ 0x1] config in time_base: 1/30000, frame_rate: 30000/1001
[Parsed_showinfo_2 @ 0x1] n:   0 pts:      0 pts_time:0       duration:1001 fmt:yuv422p10le sar:1/1 s:540x960 i:P iskey:1 type:I
[Parsed_showinfo_2 @ 0x1] color_range:tv color_space:bt709
[Parsed_showinfo_2 @ 0x1] n:   1 pts:  15015 pts_time:0.5005  duration:1001 fmt:yuv422p10le sar:1/1 s:540x960 i:P iskey:0 type:P
[Parsed_showinfo_2 @ 0x1] n:   2 pts:  30030 pts_time:1.001   duration:1001 fmt:yuv422p10le sar:1/1 s:540x960 i:P iskey:0 type:P`;

describe('parseShowinfo', () => {
  it('reads one entry per frame and ignores the surrounding lines', () => {
    expect(parseShowinfo(SHOWINFO).map((line) => line.n)).toEqual([0, 1, 2]);
  });

  // The reels are 30000/1001, so the sample grid and the real timestamps
  // diverge from the second frame onward and keep diverging. Reading
  // index/sampleFps instead would put every subtitle and zone a few
  // milliseconds early, growing through the reel.
  it('keeps the presentation timestamp rather than the nominal grid', () => {
    expect(parseShowinfo(SHOWINFO).map((line) => line.ptsTime)).toEqual([0, 0.5005, 1.001]);
  });

  it('reads the frame size the filter chain actually produced', () => {
    expect(parseShowinfo(SHOWINFO)[0]).toMatchObject({ width: 540, height: 960 });
  });

  it('returns nothing when showinfo was not in the chain', () => {
    expect(parseShowinfo('frame=  44 fps=1.2 q=-0.0 Lsize=N/A')).toEqual([]);
  });
});

describe('summarise', () => {
  const frame = (personPixelRatio: number, bbox: { x: number } | null = { x: 0 }) =>
    ({ personPixelRatio, bbox }) as never;

  it('reports the extremes and the median of an odd-length run', () => {
    expect(summarise([frame(0.3), frame(0.1), frame(0.2)])).toMatchObject({
      min: 0.1,
      median: 0.2,
      max: 0.3,
    });
  });

  it('averages the middle pair of an even-length run', () => {
    expect(summarise([frame(0.4), frame(0.1), frame(0.2), frame(0.3)]).median).toBeCloseTo(0.25);
  });

  it('counts the frames that found nobody', () => {
    expect(summarise([frame(0.2), frame(0, null)]).nullBoxes).toBe(1);
  });

  it('refuses an empty run rather than reporting NaN', () => {
    expect(() => summarise([])).toThrow(/no frames/);
  });
});

describe('the final frame', () => {
  // The 2 fps grid stops at the last sample on the grid, which left 0.4671 s
  // of test-1 unobserved and made a slot ending inside that tail unplaceable.
  it('is flagged so nothing mistakes it for a grid sample', () => {
    const manifest = readFramesManifest(TEST_1);
    const last = manifest.frames[manifest.frames.length - 1];
    expect(manifest.hasFinalFrame).toBe(true);
    expect(last?.final).toBe(true);
  });

  it('carries a real presentation timestamp past the last grid sample', () => {
    const manifest = readFramesManifest(TEST_1);
    const frames = manifest.frames;
    const last = frames[frames.length - 1]!;
    const previous = frames[frames.length - 2]!;
    expect(manifest.timestamps).toBe('pts');
    expect(last.timeS).toBeGreaterThan(previous.timeS);
    expect(last.timeS).toBeLessThanOrEqual(manifest.sourceDurationS);
  });

  // Every other interval is 1/SAMPLE_FPS; this one is shorter, which is the
  // whole reason nothing downstream may infer a timestamp from an index.
  it('sits closer to its predecessor than the sample interval', () => {
    const frames = readFramesManifest(TEST_1).frames;
    const last = frames[frames.length - 1]!;
    const previous = frames[frames.length - 2]!;
    expect(last.timeS - previous.timeS).toBeLessThan(1 / SAMPLE_FPS);
  });

  it('is the only frame flagged final', () => {
    const frames = readFramesManifest(TEST_1).frames;
    expect(frames.filter((f) => f.final).length).toBe(1);
  });

  it('is not swept into the numbered grid by the frame filter', () => {
    // A numbered final frame would desynchronise showinfo's timestamps from
    // the files they describe on the next run.
    const frames = readFramesManifest(TEST_1).frames;
    expect(frames[frames.length - 1]?.path).toContain(FINAL_FRAME_NAME);
    expect(/frame-\d+\.png$/.test(FINAL_FRAME_NAME)).toBe(false);
  });
});
