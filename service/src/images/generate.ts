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
import { expectedDimensions } from './image-dimensions.js';

/**
 * A response whose dimensions are not the ones requested. Hard error, not a
 * warning: session 2 showed the served token count for an unrequested shape
 * matches no published (size, aspect) pair, so such a response is an
 * **unpriced request** and its cost cannot be predicted or checked. Caching
 * it would also hand the next stage a candidate of the wrong shape.
 */
export class ImageDimensionMismatchError extends Error {
  constructor(
    readonly modelId: string,
    readonly requested: { width: number; height: number },
    readonly received: { width: number | null; height: number | null },
  ) {
    const unreadable = received.width === null || received.height === null;
    super(
      unreadable
        ? `${modelId} returned bytes whose dimensions could not be read, for a request of ` +
          `${requested.width}x${requested.height}. Nothing was cached or written: an image ` +
          'that cannot be measured cannot be confirmed to be the tier that was paid for.'
        : `${modelId} returned ${received.width}x${received.height} for a request of ` +
          `${requested.width}x${requested.height}. Nothing was cached or written; ` +
          'a served shape that matches no published (size, aspect) pair is an unpriced request.',
    );
    this.name = 'ImageDimensionMismatchError';
  }
}

export const IMAGE_LEDGER_STAGE = 'images-generate';

/**
 * Image entries kept per video. Sized for several models x several
 * candidates over the slots of one reel, because regenerating one is ~$0.12
 * and keeping one is ~1.5MB.
 */
export const MAX_IMAGE_ENTRIES_PER_VIDEO = 64;

export interface GeneratedCandidate {
  slotId: string;
  candidateIndex: number;
  id: string;
  path: string;
  modelId: string;
  resolution: string;
  generatedAt: string;
  width: number | null;
  height: number | null;
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
  // Every entry this run touched, hit or miss. Eviction may never remove one.
  const writtenDirs: string[] = [];

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

      writtenDirs.push(ref.dir);

      if (useCache) {
        const hit = await readImageCache(ref);
        if (hit.warning !== null) warnings.push(hit.warning);
        if (hit.payload !== null) {
          cachedImages += 1;
          candidates.push({
            slotId: slot.id, candidateIndex: index, id,
            path: path.join(ref.dir, hit.payload.file),
            modelId: hit.payload.modelId, resolution: hit.payload.resolution,
            generatedAt: hit.payload.generatedAt,
            width: hit.payload.width ?? null, height: hit.payload.height ?? null,
            costUsd: 0,
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

      // Checked before anything is billed, cached or written. The call has
      // already cost money either way, but a wrong-shaped image must not
      // enter the cache or the plan.
      const wanted = expectedDimensions(config.resolution, config.aspectRatio);
      if (wanted !== null && (image.width !== wanted.width || image.height !== wanted.height)) {
        throw new ImageDimensionMismatchError(config.modelId, wanted, {
          width: image.width,
          height: image.height,
        });
      }

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
          width: image.width, height: image.height,
        },
        image.bytes,
      );

      candidates.push({
        slotId: slot.id, candidateIndex: index, id,
        path: path.join(ref.dir, file),
        modelId: config.modelId, resolution: config.resolution,
        generatedAt, width: image.width, height: image.height,
        costUsd: actualUsd, estimatedUsd: perImageUsd, cached: false,
        text: image.text, bytes: image.bytes.length, mimeType: image.mimeType, wallTimeS,
      });
    }
  }

  // Stage-scoped, so an image write can never evict the transcription entry,
  // and every entry this run wrote is protected outright.
  //
  // The budget used to be this call's own image count. That is wrong for any
  // run that calls twice over one video — the two arms of the Block 4 model
  // bake-off did exactly that, and the second arm evicted the first arm's
  // three entries, so the cache-hit check regenerated six images at $0.51.
  // An image costs ~$0.12 to regenerate and ~1.5MB to keep, so the trade is
  // heavily toward keeping.
  await evictStaleEntries(
    videoSha256,
    cacheRoot,
    MAX_IMAGE_ENTRIES_PER_VIDEO,
    IMAGE_CACHE_STAGE,
    writtenDirs,
  );

  return { candidates, warnings, totalUsd, billedImages, cachedImages };
}

export const GEMINI_IMAGE_MODEL_IDS = Object.keys(modelConfig.geminiImagePrices.models);
