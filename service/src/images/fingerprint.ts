import { createHash } from 'node:crypto';
import type { ClientMode, ImageResolution } from '@framopia/core';

/**
 * Same scheme as the transcription and analysis fingerprints: sha256 of a
 * fixed-order array, truncated to 16 hex characters. Fixed order is what
 * makes the hash independent of the order the caller supplies fields in —
 * the object's keys are never hashed.
 *
 * The composed prompt is hashed rather than its ingredients because the mode
 * style fragments, the palette, the variation draw and the idea all reach the
 * model only through it.
 *
 * **There is deliberately no mode content hash here, and no mode version.**
 * The analysis stages need one because their prompts are assembled inside the
 * call out of mode fields nothing else keys on; this call's entire mode
 * contribution is the two prompt strings, and both are hashed verbatim. A
 * mode edit that changes what this request sends changes `prompt` or
 * `negativePrompt` and invalidates on its own; one that does not, cannot have
 * changed the bytes.
 *
 * `modeVersion` used to key. Block 6 session 7 bumped the mode v5 -> v6 to add
 * two template ids that no image call reads and stranded 14 generated images,
 * $2.064064 of billed API spend, for an edit the model could not have seen.
 * The earlier justification — that a bump may change what a *later* slot draws
 * from the variation axes — does not hold: that later slot's own prompt then
 * changes, so it misses on its own key, while this slot's cached bytes are
 * still the right answer to this slot's unchanged request.
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
  /** Namespacing only. Every mode field the request carries is in the prompt. */
  modeId: string;
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
  ]);
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}
