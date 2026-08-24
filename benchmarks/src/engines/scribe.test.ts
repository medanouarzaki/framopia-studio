import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIXTURES_DIR } from '../paths.js';
import {
  estimateScribeCost,
  mapScribeResponse,
  SCRIBE_KEYTERM_SURCHARGE,
  SCRIBE_USD_PER_AUDIO_HOUR,
  type ScribeRawResponse,
} from './scribe.js';

function loadFixture(): ScribeRawResponse {
  const raw = readFileSync(path.join(FIXTURES_DIR, 'scribe-response.json'), 'utf8');
  return JSON.parse(raw) as ScribeRawResponse;
}

describe('mapScribeResponse', () => {
  it('drops spacing entries and keeps only words', () => {
    const words = mapScribeResponse(loadFixture());
    expect(words.map((w) => w.text)).toEqual(['wach', 'nta', 'mzyan']);
  });

  it('carries start/end timestamps through unchanged', () => {
    const words = mapScribeResponse(loadFixture());
    expect(words[0]).toMatchObject({ startS: 0.0, endS: 0.32 });
  });

  it('converts logprob to a (0, 1] confidence score', () => {
    const words = mapScribeResponse(loadFixture());
    expect(words[0]?.confidence).toBeGreaterThan(0);
    expect(words[0]?.confidence).toBeLessThanOrEqual(1);
  });
});

describe('estimateScribeCost', () => {
  it('charges the configured rate per audio hour with no keyterms', () => {
    expect(estimateScribeCost(3600, false)).toBeCloseTo(SCRIBE_USD_PER_AUDIO_HOUR, 12);
  });

  it('adds the keyterm surcharge on top of the hourly rate', () => {
    expect(estimateScribeCost(3600, true)).toBeCloseTo(
      SCRIBE_USD_PER_AUDIO_HOUR * (1 + SCRIBE_KEYTERM_SURCHARGE),
      12,
    );
  });

  // A 30s clip costs ~$0.0018, which is inside toBeCloseTo's default
  // tolerance of 0.005 — without an explicit precision this assertion would
  // accept zero, or any wrong answer up to three times the right one.
  it('scales linearly with a short clip', () => {
    expect(estimateScribeCost(30, false)).toBeCloseTo(
      (30 / 3600) * SCRIBE_USD_PER_AUDIO_HOUR,
      12,
    );
  });
});
