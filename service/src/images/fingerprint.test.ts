import { describe, expect, it } from 'vitest';
import { loadMode, type ClientMode } from '@framopia/core';
import { imageFingerprintInputs, imageFingerprintOf } from './fingerprint.js';

const mode = loadMode('k2-syndicalia');

const base = {
  prompt: 'a single clear idea, lit against #1A0000',
  negativePrompt: 'no text, no watermark',
  modelId: 'gemini-3.1-flash-image',
  resolution: '1K' as const,
  candidateIndex: 0,
  mode,
};

describe('imageFingerprintOf', () => {
  it('is stable for identical inputs', () => {
    expect(imageFingerprintOf(imageFingerprintInputs(base))).toBe(
      imageFingerprintOf(imageFingerprintInputs(base)),
    );
  });

  it('is 16 hex characters', () => {
    expect(imageFingerprintOf(imageFingerprintInputs(base))).toMatch(/^[0-9a-f]{16}$/);
  });

  it('changes when any single input changes', () => {
    const original = imageFingerprintOf(imageFingerprintInputs(base));
    const variants = [
      { ...base, prompt: `${base.prompt} ` },
      { ...base, negativePrompt: 'no text' },
      { ...base, modelId: 'gemini-3-pro-image' },
      { ...base, resolution: '2K' as const },
      { ...base, candidateIndex: 1 },
      { ...base, mode: { ...mode, id: 'other-client' } as ClientMode },
      { ...base, mode: { ...mode, version: mode.version + 1 } as ClientMode },
    ];
    for (const v of variants) {
      expect(imageFingerprintOf(imageFingerprintInputs(v))).not.toBe(original);
    }
    expect(new Set(variants.map((v) => imageFingerprintOf(imageFingerprintInputs(v)))).size).toBe(
      variants.length,
    );
  });

  // A mode bump has to invalidate even when this slot's prompt is unchanged:
  // it may have changed what a later slot draws from the variation axes.
  it('invalidates on a mode version bump', () => {
    const bumped = { ...mode, version: mode.version + 1 } as ClientMode;
    expect(imageFingerprintOf(imageFingerprintInputs({ ...base, mode: bumped }))).not.toBe(
      imageFingerprintOf(imageFingerprintInputs(base)),
    );
  });

  it('does not depend on the order the fields were written in', () => {
    const forwards = imageFingerprintInputs(base);
    const backwards = {
      modeVersion: forwards.modeVersion,
      modeId: forwards.modeId,
      candidateIndex: forwards.candidateIndex,
      resolution: forwards.resolution,
      modelId: forwards.modelId,
      negativePrompt: forwards.negativePrompt,
      prompt: forwards.prompt,
    };
    expect(imageFingerprintOf(backwards)).toBe(imageFingerprintOf(forwards));
  });
});
