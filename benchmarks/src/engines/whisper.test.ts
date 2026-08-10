import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIXTURES_DIR } from '../paths.js';
import { mapWhisperResponse, type WhisperRawResponse } from './whisper.js';

function loadFixture(): WhisperRawResponse {
  const raw = readFileSync(path.join(FIXTURES_DIR, 'whisper-response.json'), 'utf8');
  return JSON.parse(raw) as WhisperRawResponse;
}

describe('mapWhisperResponse', () => {
  it('flattens segments into a single word list', () => {
    const words = mapWhisperResponse(loadFixture());
    expect(words).toHaveLength(3);
  });

  it('trims the leading-space tokenizer artifact from word text', () => {
    const words = mapWhisperResponse(loadFixture());
    expect(words.map((w) => w.text)).toEqual(['wach', 'nta', 'mzyan']);
  });

  it('maps probability to confidence and start/end through unchanged', () => {
    const words = mapWhisperResponse(loadFixture());
    expect(words[0]).toMatchObject({ startS: 0.0, endS: 0.32, confidence: 0.98 });
  });
});
