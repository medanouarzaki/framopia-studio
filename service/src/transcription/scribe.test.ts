import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { mapScribeResponse, type ScribeRawResponse } from './scribe.js';

const FIXTURES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'fixtures',
);

function loadFixture(): ScribeRawResponse {
  return JSON.parse(
    readFileSync(path.join(FIXTURES_DIR, 'scribe-response.json'), 'utf8'),
  ) as ScribeRawResponse;
}

describe('mapScribeResponse', () => {
  it('drops spacing and audio-event entries', () => {
    const raw = loadFixture();
    const mapped = mapScribeResponse(raw);
    expect(mapped).toHaveLength(raw.words.filter((w) => w.type === 'word').length);
    expect(mapped.length).toBeLessThan(raw.words.length);
  });

  it('maps logprob to a confidence in (0, 1]', () => {
    const mapped = mapScribeResponse(loadFixture());
    for (const word of mapped) {
      expect(word.confidence).not.toBeNull();
      expect(word.confidence!).toBeGreaterThan(0);
      expect(word.confidence!).toBeLessThanOrEqual(1);
    }
  });

  it('preserves word start and end timings', () => {
    const mapped = mapScribeResponse(loadFixture());
    expect(mapped[0]?.start).toBe(0.099);
    expect(mapped.every((w) => w.start !== null && w.end !== null)).toBe(true);
  });
});
