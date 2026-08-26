import { describe, expect, it } from 'vitest';
import { loadMode, type ClientMode } from '@framopia/core';
import { imageFingerprintInputs, imageFingerprintOf } from './fingerprint.js';

const mode = loadMode('k2-syndicalia');

const base = {
  prompt: 'a single clear idea, lit against #1A0000',
  negativePrompt: 'no text, no watermark',
  modelId: 'gemini-3.1-flash-image',
  resolution: '1K' as const,
  aspectRatio: '1:1',
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
      { ...base, aspectRatio: '9:16' },
      { ...base, candidateIndex: 1 },
      { ...base, mode: { ...mode, id: 'other-client' } as ClientMode },
    ];
    for (const v of variants) {
      expect(imageFingerprintOf(imageFingerprintInputs(v))).not.toBe(original);
    }
    expect(new Set(variants.map((v) => imageFingerprintOf(imageFingerprintInputs(v)))).size).toBe(
      variants.length,
    );
  });

  // The whole point of the Block 7 change. Block 6 session 7 bumped the mode
  // v5 -> v6 to add two template ids no image call reads and stranded 14
  // generated images ($2.064064) that were still the right answer to an
  // unchanged request.
  it('survives a mode version bump that changes nothing the call reads', () => {
    const bumped = {
      ...mode,
      version: mode.version + 1,
      allowedTemplates: {
        ...mode.allowedTemplates,
        subtitle: [...mode.allowedTemplates.subtitle, 'sub_pop_extra'],
      },
    } as ClientMode;
    expect(imageFingerprintOf(imageFingerprintInputs({ ...base, mode: bumped }))).toBe(
      imageFingerprintOf(imageFingerprintInputs(base)),
    );
  });

  // The fields that used to key through `mode.version` reach the request only
  // as prompt text, so they still invalidate — via the string, not the number.
  it('invalidates when a mode edit reaches the composed prompt', () => {
    const original = imageFingerprintOf(imageFingerprintInputs(base));
    const recomposed = { ...base, prompt: `${base.prompt}, seen from above` };
    expect(imageFingerprintOf(imageFingerprintInputs(recomposed))).not.toBe(original);
    const negatives = { ...base, negativePrompt: `${base.negativePrompt}, no hands` };
    expect(imageFingerprintOf(imageFingerprintInputs(negatives))).not.toBe(original);
  });

  /**
   * The frozen config, docs/DECISION-image-config.md: gemini-3-pro-image at 2K,
   * 1:1. Session 1 removed the mode from the key on the reasoning that every
   * mode field reaches the request as prompt text; these five are what the key
   * has to carry for that reasoning to hold, so each is pinned on its own
   * rather than left to the omnibus "changes when any single input changes"
   * test above. A silent drop here does not fail anything — it serves one
   * slot's image for a different request.
   */
  describe('the frozen image config is in the key', () => {
    const frozen = {
      ...base,
      modelId: 'gemini-3-pro-image',
      resolution: '2K' as const,
      aspectRatio: '1:1',
    };
    const key = imageFingerprintOf(imageFingerprintInputs(frozen));

    it('the model pin', () => {
      expect(imageFingerprintOf(imageFingerprintInputs({
        ...frozen, modelId: 'gemini-3.1-flash-image',
      }))).not.toBe(key);
    });

    it('the image size', () => {
      expect(imageFingerprintOf(imageFingerprintInputs({
        ...frozen, resolution: '1K' as const,
      }))).not.toBe(key);
    });

    it('the aspect ratio', () => {
      expect(imageFingerprintOf(imageFingerprintInputs({
        ...frozen, aspectRatio: '9:16',
      }))).not.toBe(key);
    });

    it('the composed prompt', () => {
      expect(imageFingerprintOf(imageFingerprintInputs({
        ...frozen, prompt: `${frozen.prompt}, seen from below`,
      }))).not.toBe(key);
    });

    it('the negative prompt', () => {
      expect(imageFingerprintOf(imageFingerprintInputs({
        ...frozen, negativePrompt: `${frozen.negativePrompt}, no hands`,
      }))).not.toBe(key);
    });
  });

  it('does not depend on the order the fields were written in', () => {
    const forwards = imageFingerprintInputs(base);
    const backwards = {
      modeId: forwards.modeId,
      candidateIndex: forwards.candidateIndex,
      aspectRatio: forwards.aspectRatio,
      resolution: forwards.resolution,
      modelId: forwards.modelId,
      negativePrompt: forwards.negativePrompt,
      prompt: forwards.prompt,
    };
    expect(imageFingerprintOf(backwards)).toBe(imageFingerprintOf(forwards));
  });
});
