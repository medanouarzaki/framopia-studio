import { estimateImageRunCost, type ImageRunEstimate } from '@framopia/core';
import type { ImageGenerationConfig } from './config.js';

export class ImageBudgetExceededError extends Error {
  constructor(
    readonly estimate: ImageRunEstimate,
    readonly ceilingUsd: number,
  ) {
    super(
      `Estimated $${estimate.usd.toFixed(4)} for ${estimate.images} images ` +
        `(${estimate.slots} slots x ${estimate.candidatesPerSlot}) on ${estimate.modelId} ` +
        `at ${estimate.resolution}, over the $${ceilingUsd.toFixed(2)} ceiling. Nothing was generated.`,
    );
    this.name = 'ImageBudgetExceededError';
  }
}

export function estimateRun(slots: number, config: ImageGenerationConfig): ImageRunEstimate {
  return estimateImageRunCost({
    modelId: config.modelId,
    resolution: config.resolution,
    slots,
    candidatesPerSlot: config.candidatesPerSlot,
  });
}

export function formatEstimate(estimate: ImageRunEstimate, cachedImages = 0): string {
  const billable = Math.max(0, estimate.images - cachedImages);
  const billableUsd = billable * estimate.perImageUsd;
  const lines = [
    `Image generation estimate: ${estimate.modelId} at ${estimate.resolution}, ` +
      `$${estimate.perImageUsd.toFixed(4)} per image.`,
    `  ${estimate.slots} slots x ${estimate.candidatesPerSlot} candidates = ${estimate.images} images`,
  ];
  if (cachedImages > 0) {
    lines.push(`  ${cachedImages} already cached, ${billable} to generate`);
  }
  lines.push(`  estimated cost: $${billableUsd.toFixed(4)}`);
  return lines.join('\n');
}

/**
 * The gate. Checks the whole run before the first call, so an over-budget run
 * costs nothing rather than aborting halfway with images already billed.
 */
export function assertWithinCeiling(estimate: ImageRunEstimate, ceilingUsd: number): void {
  if (estimate.usd > ceilingUsd) throw new ImageBudgetExceededError(estimate, ceilingUsd);
}
