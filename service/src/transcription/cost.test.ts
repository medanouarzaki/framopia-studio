import { modelConfig, SCRIBE_USD_PER_AUDIO_HOUR, SCRIBE_KEYTERM_SURCHARGE } from '@framopia/core';
import { describe, expect, it } from 'vitest';
import { computeHybridCost } from './cost.js';

// The usage actually returned by the vitasilk correction call, recorded in
// benchmarks/results/2026-08-24T21-47-38-860Z/raw/hybrid-correction.json.
const VITASILK_USAGE = {
  promptTokenCount: 4329,
  candidatesTokenCount: 1096,
  thoughtsTokenCount: 7433,
  promptTokensDetails: [
    { modality: 'TEXT', tokenCount: 3686 },
    { modality: 'AUDIO', tokenCount: 643 },
  ],
};

describe('computeHybridCost', () => {
  it('totals exactly the sum of its two parts', () => {
    const cost = computeHybridCost(25.692333, false, VITASILK_USAGE);
    expect(cost.totalUsd).toBeCloseTo(cost.scribeUsd + cost.geminiUsd, 12);
  });

  it('prices scribe from the duration at the audio-hour rate', () => {
    const cost = computeHybridCost(25.692333, false, {});
    expect(cost.scribeUsd).toBeCloseTo((25.692333 / 3600) * SCRIBE_USD_PER_AUDIO_HOUR, 12);
    expect(cost.geminiUsd).toBe(0);
    expect(cost.totalUsd).toBe(cost.scribeUsd);
  });

  it('applies the keyterm surcharge to the scribe leg only', () => {
    const plain = computeHybridCost(25.692333, false, VITASILK_USAGE);
    const withKeyterms = computeHybridCost(25.692333, true, VITASILK_USAGE);
    expect(withKeyterms.scribeUsd).toBeCloseTo(plain.scribeUsd * (1 + SCRIBE_KEYTERM_SURCHARGE), 12);
    expect(withKeyterms.geminiUsd).toBe(plain.geminiUsd);
  });

  it('bills thinking tokens at the output rate', () => {
    const withThinking = computeHybridCost(25.692333, false, VITASILK_USAGE);
    const withoutThinking = computeHybridCost(25.692333, false, {
      ...VITASILK_USAGE,
      thoughtsTokenCount: 0,
    });
    expect(withThinking.geminiUsd - withoutThinking.geminiUsd).toBeCloseTo(
      (7433 / 1_000_000) * modelConfig.geminiPrices.outputUsdPerMillionTokens,
      12,
    );
    // The recorded call: 7433 thinking tokens against 1096 visible output, so
    // omitting them would under-report this leg by nearly seven times.
    expect(withThinking.geminiUsd).toBeGreaterThan(withoutThinking.geminiUsd * 5);
  });

  it('matches the figure recorded for the vitasilk correction call', () => {
    const { geminiPrices } = modelConfig;
    const expected =
      (3686 / 1_000_000) * geminiPrices.textInputUsdPerMillionTokens +
      (643 / 1_000_000) * geminiPrices.audioInputUsdPerMillionTokens +
      ((1096 + 7433) / 1_000_000) * geminiPrices.outputUsdPerMillionTokens;
    expect(computeHybridCost(25.692333, false, VITASILK_USAGE).geminiUsd).toBeCloseTo(expected, 12);
  });
});
