import { createHash } from 'node:crypto';
import type { ClientMode, ImageResolution } from '@framopia/core';

/**
 * Same scheme as the transcription and analysis fingerprints: sha256 of a
 * fixed-order array, truncated to 16 hex characters. Fixed order is what
 * makes the hash independent of the order the caller supplies fields in —
 * the object's keys are never hashed.
 *
 * The composed prompt is hashed rather than its ingredients because the mode
 * style fragments, the variation draw and the idea all reach the model only
 * through it. The mode id and version key anyway: a mode bump that changes
 * nothing in this slot's prompt still has to invalidate, because it may have
 * changed what the next slot draws.
 */
export interface ImageFingerprintInputs {
  prompt: string;
  negativePrompt: string;
  modelId: string;
  resolution: ImageResolution;
  /** Part of the key: it changes the pixels and it changes the price. */
  aspectRatio: string;
  /** Two candidates for one slot differ only here. */
  candidateIndex: number;
  modeId: string;
  modeVersion: number;
}

export function imageFingerprintInputs(options: {
  prompt: string;
  negativePrompt: string;
  modelId: string;
  resolution: ImageResolution;
  aspectRatio: string;
  candidateIndex: number;
  mode: ClientMode;
}): ImageFingerprintInputs {
  return {
    prompt: options.prompt,
    negativePrompt: options.negativePrompt,
    modelId: options.modelId,
    resolution: options.resolution,
    aspectRatio: options.aspectRatio,
    candidateIndex: options.candidateIndex,
    modeId: options.mode.id,
    modeVersion: options.mode.version,
  };
}

export function imageFingerprintOf(inputs: ImageFingerprintInputs): string {
  const canonical = JSON.stringify([
    inputs.prompt,
    inputs.negativePrompt,
    inputs.modelId,
    inputs.resolution,
    inputs.aspectRatio,
    inputs.candidateIndex,
    inputs.modeId,
    inputs.modeVersion,
  ]);
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}
