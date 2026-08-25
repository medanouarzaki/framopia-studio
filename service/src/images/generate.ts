import path from 'node:path';
import {
  appendCost,
  computeImageCost,
  computeImageCostFromUsage,
  modelConfig,
  type ClientMode,
} from '@framopia/core';
import { cacheEntryDir, evictStaleEntries, type CacheEntryRef } from '../transcription/cache.js';
import type { ImageSlot } from '../editplan/types.js';
import type { ImageGenerationClient } from './client.js';
import type { ImageGenerationConfig } from './config.js';
import { IMAGE_CACHE_STAGE, imageFileName, readImageCache, writeImageCache } from './cache.js';
import { imageFingerprintInputs, imageFingerprintOf } from './fingerprint.js';
import { assertWithinCeiling, estimateRun, formatEstimate } from './estimate.js';

export const IMAGE_LEDGER_STAGE = 'images-generate';

export interface GeneratedCandidate {
  slotId: string;
  candidateIndex: number;
  id: string;
  path: string;
  modelId: string;
  resolution: string;
  generatedAt: string;
  /** Billed, from usageMetadata. Never the price-table figure. */
  costUsd: number;
  /** The published per-image rate, kept beside the actual so they can be compared. */
  estimatedUsd: number;
  cached: boolean;
  /** Whatever the model said alongside the bytes. */
  text: string | null;
  bytes: number;
  mimeType: string;
  wallTimeS: number;
}

export interface GenerateImagesResult {
  candidates: GeneratedCandidate[];
  warnings: string[];
  totalUsd: number;
  billedImages: number;
  cachedImages: number;
}

/**
 * Generates every candidate for every slot.
 *
 * `appendCost` is called at the point of spend and nowhere else: once per
 * image that the client was actually asked for, after it returned. Block 3
 * session 3 wrote eight fabricated ledger lines by billing in a wrapper
 * around a call that never happened, so a cache hit bills nothing, an
 * injected fake bills nothing, and a throw before the call bills nothing.
 */
export async function generateImages(options: {
  slots: ImageSlot[];
  mode: ClientMode;
  config: ImageGenerationConfig;
  client: ImageGenerationClient;
  videoSha256: string;
  cacheRoot?: string;
  useCache?: boolean;
  /** Set only by the caller that actually spends. */
  bill?: boolean;
  /**
   * Stop after this many candidates in total. The bake-off uses it to
   * generate one image and halt: a response-parsing defect found on image 1
   * costs $0.10, found on image 6 it costs $0.70.
   */
  limit?: number;
  log?: (message: string) => void;
}): Promise<GenerateImagesResult> {
  const {
    slots, mode, config, client, videoSha256,
    cacheRoot, useCache = true, bill = false, limit, log = () => {},
  } = options;

  const estimate = estimateRun(slots.length, config);
  assertWithinCeiling(estimate, config.ceilingUsd);
  log(formatEstimate(estimate));

  const perImageUsd = computeImageCost(config.modelId, config.resolution);
  const candidates: GeneratedCandidate[] = [];
  const warnings: string[] = [];
  let totalUsd = 0;
  let billedImages = 0;
  let cachedImages = 0;

  for (const slot of slots) {
    for (let index = 0; index < config.candidatesPerSlot; index += 1) {
      if (limit !== undefined && candidates.length >= limit) break;
      const fingerprint = imageFingerprintOf(
        imageFingerprintInputs({
          prompt: slot.prompt,
          negativePrompt: slot.negativePrompt,
          modelId: config.modelId,
          resolution: config.resolution,
          aspectRatio: config.aspectRatio,
          candidateIndex: index,
          mode,
        }),
      );
      const ref: CacheEntryRef = {
        dir: cacheEntryDir(videoSha256, IMAGE_CACHE_STAGE, fingerprint, cacheRoot),
        videoSha256,
        stage: IMAGE_CACHE_STAGE,
        fingerprint,
      };
      const id = `${slot.id}-c${index + 1}`;

      if (useCache) {
        const hit = await readImageCache(ref);
        if (hit.warning !== null) warnings.push(hit.warning);
        if (hit.payload !== null) {
          cachedImages += 1;
          candidates.push({
            slotId: slot.id, candidateIndex: index, id,
            path: path.join(ref.dir, hit.payload.file),
            modelId: hit.payload.modelId, resolution: hit.payload.resolution,
            generatedAt: hit.payload.generatedAt, costUsd: 0,
            estimatedUsd: perImageUsd, cached: true,
            text: hit.payload.text ?? null, bytes: 0,
            mimeType: hit.payload.mimeType, wallTimeS: 0,
          });
          continue;
        }
      }

      const startedAt = Date.now();
      const image = await client.generate({
        modelId: config.modelId,
        prompt: slot.prompt,
        negativePrompt: slot.negativePrompt,
        resolution: config.resolution,
        aspectRatio: config.aspectRatio,
      });

      // The call returned, so it was billed by Google whether or not this
      // process records it. Everything below is bookkeeping for that fact.
      //
      // The ledger takes the figure computed from usageMetadata, never the
      // price table: the table is what the estimate is built from, and an
      // estimate recorded as an actual is how a ledger stops being evidence.
      const actualUsd = computeImageCostFromUsage(config.modelId, image.usage);
      if (bill) {
        appendCost({
          stage: IMAGE_LEDGER_STAGE,
          model: config.modelId,
          unit: 'image',
          usd: actualUsd,
        });
      }
      totalUsd += actualUsd;
      billedImages += 1;

      const generatedAt = new Date().toISOString();
      const wallTimeS = (Date.now() - startedAt) / 1000;
      const file = imageFileName(image.mimeType);
      await writeImageCache(
        ref,
        {
          prompt: slot.prompt, negativePrompt: slot.negativePrompt,
          modelId: config.modelId, resolution: config.resolution,
          candidateIndex: index, modeId: mode.id, modeVersion: mode.version,
          mimeType: image.mimeType, file, costUsd: actualUsd, generatedAt,
        },
        image.bytes,
      );

      candidates.push({
        slotId: slot.id, candidateIndex: index, id,
        path: path.join(ref.dir, file),
        modelId: config.modelId, resolution: config.resolution,
        generatedAt, costUsd: actualUsd, estimatedUsd: perImageUsd, cached: false,
        text: image.text, bytes: image.bytes.length, mimeType: image.mimeType, wallTimeS,
      });
    }
  }

  // Stage-scoped, so an image write can never evict the transcription entry.
  // Keeps one entry per image rather than three per video: the budget below
  // is candidates-worth, not configurations-worth.
  await evictStaleEntries(
    videoSha256,
    cacheRoot,
    Math.max(slots.length * config.candidatesPerSlot, 1),
    IMAGE_CACHE_STAGE,
  );

  return { candidates, warnings, totalUsd, billedImages, cachedImages };
}

export const GEMINI_IMAGE_MODEL_IDS = Object.keys(modelConfig.geminiImagePrices.models);
