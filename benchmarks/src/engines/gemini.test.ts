import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIXTURES_DIR } from '../paths.js';
import { computeGeminiCost, parseGeminiResponseText } from './gemini.js';

interface GeminiFixture {
  text: string;
  usageMetadata: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    promptTokensDetails: { modality: string; tokenCount: number }[];
  };
}

function loadFixture(): GeminiFixture {
  const raw = readFileSync(path.join(FIXTURES_DIR, 'gemini-response.json'), 'utf8');
  return JSON.parse(raw) as GeminiFixture;
}

describe('parseGeminiResponseText', () => {
  it('parses plain strict JSON', () => {
    const words = parseGeminiResponseText(loadFixture().text);
    expect(words.map((w) => w.text)).toEqual(['wach', 'nta', 'mzyan']);
    expect(words[0]).toMatchObject({ startS: 0.0, endS: 0.32, confidence: null });
  });

  it('strips a markdown code fence around the JSON', () => {
    const fenced = '```json\n{"words":[{"text":"daba","startS":0,"endS":0.3}]}\n```';
    const words = parseGeminiResponseText(fenced);
    expect(words).toEqual([{ text: 'daba', startS: 0, endS: 0.3, confidence: null }]);
  });

  it('throws on malformed JSON', () => {
    expect(() => parseGeminiResponseText('not json')).toThrow();
  });

  it('throws when the words array is missing', () => {
    expect(() => parseGeminiResponseText('{}')).toThrow(/words/);
  });
});

describe('computeGeminiCost', () => {
  it('prices text and audio prompt tokens separately via promptTokensDetails', () => {
    const { usageMetadata } = loadFixture();
    const cost = computeGeminiCost(usageMetadata);
    // 900 text tok @1.25/M + 300 audio tok @1.25/M + 40 output tok @10/M
    const expected = (900 / 1_000_000) * 1.25 + (300 / 1_000_000) * 1.25 + (40 / 1_000_000) * 10;
    expect(cost).toBeCloseTo(expected);
  });

  it('falls back to a flat prompt-token rate without a modality breakdown', () => {
    const cost = computeGeminiCost({ promptTokenCount: 1000, candidatesTokenCount: 100 });
    const expected = (1000 / 1_000_000) * 1.25 + (100 / 1_000_000) * 10;
    expect(cost).toBeCloseTo(expected);
  });

  it('is zero for empty usage', () => {
    expect(computeGeminiCost({})).toBe(0);
  });
});

describe('computeGeminiCost — thinking tokens', () => {
  it('bills thinking tokens at the output rate alongside visible output', () => {
    const withoutThinking = computeGeminiCost({
      promptTokenCount: 1000,
      candidatesTokenCount: 1000,
    });
    const withThinking = computeGeminiCost({
      promptTokenCount: 1000,
      candidatesTokenCount: 1000,
      thoughtsTokenCount: 1000,
    });
    expect(withThinking).toBeGreaterThan(withoutThinking);
    expect(withThinking - withoutThinking).toBeCloseTo(withoutThinking - 1000e-6 * 2.0, 9);
  });
});
