import path from 'node:path';
import { appendCost, computeImageCost, modelConfig, type ClientMode } from '@framopia/core';
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
  costUsd: number;
  cached: boolean;
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
  log?: (message: string) => void;
}): Promise<GenerateImagesResult> {
  const {
    slots, mode, config, client, videoSha256,
    cacheRoot, useCache = true, bill = false, log = () => {},
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
      const fingerprint = imageFingerprintOf(
        imageFingerprintInputs({
          prompt: slot.prompt,
          negativePrompt: slot.negativePrompt,
          modelId: config.modelId,
          resolution: config.resolution,
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
            generatedAt: hit.payload.generatedAt, costUsd: 0, cached: true,
          });
          continue;
        }
      }

      const image = await client.generate({
        modelId: config.modelId,
        prompt: slot.prompt,
        negativePrompt: slot.negativePrompt,
        resolution: config.resolution,
      });

      // The call returned, so it was billed by Google whether or not this
      // process records it. Everything below is bookkeeping for that fact.
      if (bill) {
        appendCost({
          stage: IMAGE_LEDGER_STAGE,
          model: config.modelId,
          unit: 'image',
          usd: perImageUsd,
        });
      }
      totalUsd += perImageUsd;
      billedImages += 1;

      const generatedAt = new Date().toISOString();
      const file = imageFileName(image.mimeType);
      await writeImageCache(
        ref,
        {
          prompt: slot.prompt, negativePrompt: slot.negativePrompt,
          modelId: config.modelId, resolution: config.resolution,
          candidateIndex: index, modeId: mode.id, modeVersion: mode.version,
          mimeType: image.mimeType, file, costUsd: perImageUsd, generatedAt,
        },
        image.bytes,
      );

      candidates.push({
        slotId: slot.id, candidateIndex: index, id,
        path: path.join(ref.dir, file),
        modelId: config.modelId, resolution: config.resolution,
        generatedAt, costUsd: perImageUsd, cached: false,
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
