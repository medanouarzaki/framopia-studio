import { describe, expect, it } from 'vitest';
import {
  alignCorrectedOntoScribeTimings,
  parseCorrectionResponseText,
} from './hybrid.js';
import type { TranscribedWord } from '../types.js';

function word(text: string, startS: number, endS: number): TranscribedWord {
  return { text, startS, endS, confidence: 0.9 };
}

describe('alignCorrectedOntoScribeTimings', () => {
  it('carries timing through unchanged for a match', () => {
    const scribe = [word('wach', 0, 0.3), word('mzyan', 1.0, 1.3)];
    const result = alignCorrectedOntoScribeTimings(scribe, ['wach', 'mzyan']);
    expect(result).toEqual([
      { text: 'wach', startS: 0, endS: 0.3, confidence: null },
      { text: 'mzyan', startS: 1.0, endS: 1.3, confidence: null },
    ]);
  });

  it('assigns the anchor timing directly on a substitution (spelling fix)', () => {
    const scribe = [word('bezzaf', 0, 0.5)];
    const result = alignCorrectedOntoScribeTimings(scribe, ['bzzaf']);
    expect(result).toEqual([{ text: 'bzzaf', startS: 0, endS: 0.5, confidence: null }]);
  });

  it('drops a deleted scribe word entirely, keeping surrounding timings', () => {
    const scribe = [word('wach', 0, 0.3), word('baghi', 0.5, 0.8), word('mzyan', 1.0, 1.3)];
    const result = alignCorrectedOntoScribeTimings(scribe, ['wach', 'mzyan']);
    expect(result).toEqual([
      { text: 'wach', startS: 0, endS: 0.3, confidence: null },
      { text: 'mzyan', startS: 1.0, endS: 1.3, confidence: null },
    ]);
  });

  it('interpolates a single inserted word at the midpoint between anchors', () => {
    const scribe = [word('wach', 0, 0.3), word('mzyan', 1.0, 1.3)];
    const result = alignCorrectedOntoScribeTimings(scribe, ['wach', 'nta', 'mzyan']);
    expect(result[0]).toMatchObject({ text: 'wach', startS: 0 });
    expect(result[1]?.text).toBe('nta');
    expect(result[1]?.startS).toBeCloseTo(0.65, 9);
    expect(result[2]).toMatchObject({ text: 'mzyan', startS: 1.0 });
  });

  it('interpolates a run of unmatched words evenly across the gap', () => {
    const scribe = [word('wach', 0, 0.3), word('mzyan', 2.0, 2.3)];
    const result = alignCorrectedOntoScribeTimings(scribe, ['wach', 'daba', 'nta', 'ghadi', 'mzyan']);
    const timings = result.map((w) => w.startS);
    expect(timings[0]).toBe(0);
    expect(timings[4]).toBe(2.0);
    // the three interpolated words strictly increase and stay inside the gap
    expect(timings[1]).toBeGreaterThan(0.3);
    expect(timings[2]).toBeGreaterThan(timings[1] as number);
    expect(timings[3]).toBeGreaterThan(timings[2] as number);
    expect(timings[3]).toBeLessThan(2.0);
    expect(timings[1]).toBeCloseTo(0.725, 9);
    expect(timings[2]).toBeCloseTo(1.15, 9);
    expect(timings[3]).toBeCloseTo(1.575, 9);
  });

  it('extrapolates flush against the previous anchor when nothing follows', () => {
    const scribe = [word('wach', 0, 0.3)];
    const result = alignCorrectedOntoScribeTimings(scribe, ['wach', 'daba']);
    expect(result[1]).toMatchObject({ text: 'daba', startS: 0.3 });
  });

  it('extrapolates flush against the next anchor when nothing precedes', () => {
    const scribe = [word('mzyan', 1.0, 1.3)];
    const result = alignCorrectedOntoScribeTimings(scribe, ['daba', 'mzyan']);
    expect(result[0]).toMatchObject({ text: 'daba', startS: 1.0 });
  });
});

describe('parseCorrectionResponseText', () => {
  it('parses a strict-JSON word list', () => {
    const words = parseCorrectionResponseText('{"words":[{"text":"bzzaf"}]}');
    expect(words).toEqual(['bzzaf']);
  });

  it('strips a markdown code fence', () => {
    const words = parseCorrectionResponseText('```json\n{"words":[{"text":"daba"}]}\n```');
    expect(words).toEqual(['daba']);
  });

  it('throws when the words array is missing', () => {
    expect(() => parseCorrectionResponseText('{}')).toThrow(/words/);
  });
});
