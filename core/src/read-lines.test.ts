import { describe, expect, it } from 'vitest';
import { lineDirection, readLines, timecode, READ_LINE_GAP_S, type ReadableWord } from './read-lines.js';

const word = (
  text: string,
  start: number,
  end: number,
  script: 'latin' | 'arabic' = 'latin',
  removed = false,
): ReadableWord => ({ text, start, end, script, removed });

describe('reading a transcript', () => {
  it('breaks a line after a silence and not inside speech', () => {
    const lines = readLines([
      word('عندك', 0, 0.3, 'arabic'),
      word('حصة', 0.35, 0.6, 'arabic'),
      word('ديال', 1.4, 1.7, 'arabic'),
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[0]?.words.map((w) => w.text)).toEqual(['عندك', 'حصة']);
    expect(lines[1]?.startS).toBeCloseTo(1.4, 6);
  });

  /*
   * Measured across the five corpus reels: the gap between words is 0.059 s at
   * the median and 0.381 s at the largest, so a threshold above the corpus's
   * own maximum produces one line and no reading.
   */
  it('is set where the corpus actually breaks', () => {
    expect(READ_LINE_GAP_S).toBe(0.2);
  });

  it('leaves out a word the build will not draw', () => {
    const lines = readLines([word('euh', 0, 0.2, 'latin', true), word('alors', 0.25, 0.6)]);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.words.map((w) => w.text)).toEqual(['alors']);
  });

  it('has nothing to say about an empty transcript', () => {
    expect(readLines([])).toEqual([]);
  });

  /*
   * A wholly Arabic line rendered left-to-right puts the last word first. The
   * word editor's per-token rule is right for a row that is one word beside its
   * controls; a line of prose has a direction of its own.
   */
  it('runs a mostly-Arabic line right to left, and a mostly-Latin one the other way', () => {
    expect(lineDirection([word('عندك', 0, 1, 'arabic'), word('حصة', 1, 2, 'arabic'), word('la', 2, 3)])).toBe('rtl');
    expect(lineDirection([word('la', 0, 1), word('vidéo', 1, 2), word('ديال', 2, 3, 'arabic')])).toBe('ltr');
    // An even split is not a majority, so it stays as it reads on the page.
    expect(lineDirection([word('a', 0, 1), word('ب', 1, 2, 'arabic')])).toBe('ltr');
  });

  it('writes a time a person can find in a video', () => {
    expect(timecode(0)).toBe('0:00');
    expect(timecode(9.9)).toBe('0:09');
    expect(timecode(61.2)).toBe('1:01');
    expect(timecode(-3)).toBe('0:00');
  });
});
