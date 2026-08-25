import { estimateImageRunCost, readCosts, type ImageRunEstimate } from '@framopia/core';
import type { ImageGenerationConfig } from './config.js';

/** Ledger stage the running check sums. Kept here to avoid a cycle with generate.ts. */
export const IMAGE_LEDGER_STAGE = 'images-generate';

/** Actual image spend recorded in the ledger, all time. */
export function imageLedgerTotalUsd(costsPath?: string): number {
  return readCosts(costsPath)[IMAGE_LEDGER_STAGE] ?? 0;
}

export class ImageCeilingReachedError extends Error {
  constructor(
    readonly spentUsd: number,
    readonly nextUsd: number,
    readonly ceilingUsd: number,
    readonly imagesDone: number,
  ) {
    super(
      `stopping before image ${imagesDone + 1}: $${spentUsd.toFixed(4)} already spent this ` +
        `session plus $${nextUsd.toFixed(4)} for the next image would cross the ` +
        `$${ceilingUsd.toFixed(2)} ceiling. The run is aborted, not truncated.`,
    );
    this.name = 'ImageCeilingReachedError';
  }
}

/**
 * The ceiling, re-evaluated before every request against **actual** spend read
 * back from the ledger.
 *
 * Block 4 session 3 went $0.33 over a $1.00 ceiling that was checked once,
 * pre-flight, against an estimate: the run was two arms and then a second
 * invocation, and once each was past its own check nothing looked again. The
 * baseline is captured by the caller at session start and shared by every
 * arm, so two arms cannot each spend a full ceiling.
 *
 * Crossing it aborts. It does not skip the image and carry on: a partial set
 * that looks complete is worse than a run that stopped and said so.
 */
export function assertCeilingNotReached(options: {
  baselineUsd: number;
  nextUsd: number;
  ceilingUsd: number;
  imagesDone: number;
  costsPath?: string;
}): void {
  const spent = imageLedgerTotalUsd(options.costsPath) - options.baselineUsd;
  if (spent + options.nextUsd > options.ceilingUsd) {
    throw new ImageCeilingReachedError(
      spent, options.nextUsd, options.ceilingUsd, options.imagesDone,
    );
  }
}

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
