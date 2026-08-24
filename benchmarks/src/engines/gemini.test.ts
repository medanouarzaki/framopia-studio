import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIXTURES_DIR } from '../paths.js';
import { parseGeminiResponseText } from './gemini.js';

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
