import type { ClientMode } from '@framopia/core';
import {
  cacheEntryDir,
  evictStaleEntries,
  MAX_ENTRIES_PER_VIDEO,
  CACHE_ROOT,
  type CacheEntryRef,
} from '../transcription/cache.js';
import {
  ANALYSIS_CACHE_STAGE,
  readAnalysisCache,
  readSlotCache,
  SLOT_CACHE_STAGE,
  writeAnalysisCache,
  writeSlotCache,
  type AnalysisCachePayload,
  type SlotCachePayload,
} from './cache.js';
import {
  analysisFingerprintInputs,
  analysisFingerprintOf,
  slotFingerprintInputs,
  slotFingerprintOf,
  type AnalysisFingerprintInputs,
  type SlotFingerprintInputs,
} from './fingerprint.js';
import { candidateCountFor, runKeywordAnalysis, type KeywordAnalysisResult } from './keywords.js';
import { imageSlotCountFor, keywordCountFor } from './count.js';
import { selectKeywords } from './select.js';
import { planSlots, type SlotSelectionResult } from './slot-select.js';
import { runSlotAnalysis, slotCandidateCountFor, type SlotAnalysisResult } from './slots.js';
import type { AnalysisWord, KeywordMode, SelectionResult } from './types.js';

export function analysisCacheRef(options: {
  videoSha256: string;
  mode: ClientMode;
  words: AnalysisWord[];
  candidateCount: number;
  cacheRoot?: string;
}): { ref: CacheEntryRef; inputs: AnalysisFingerprintInputs } {
  const inputs = analysisFingerprintInputs({
    mode: options.mode,
    words: options.words,
    candidateCount: options.candidateCount,
  });
  const fingerprint = analysisFingerprintOf(inputs);
  return {
    inputs,
    ref: {
      dir: cacheEntryDir(
        options.videoSha256,
        ANALYSIS_CACHE_STAGE,
        fingerprint,
        options.cacheRoot ?? CACHE_ROOT,
      ),
      videoSha256: options.videoSha256,
      stage: ANALYSIS_CACHE_STAGE,
      fingerprint,
    },
  };
}

export interface CachedKeywordOptions {
  apiKey: string;
  videoSha256: string;
  durationS: number;
  words: AnalysisWord[];
  mode: ClientMode;
  keywordMode: KeywordMode;
  bypassCache?: boolean;
  cacheRoot?: string;
  log?: (message: string) => void;
  /** Injected in tests so a hit can be exercised without an API key. */
  runAnalysis?: (options: {
    apiKey: string;
    words: AnalysisWord[];
    mode: ClientMode;
    candidateCount: number;
  }) => Promise<KeywordAnalysisResult>;
}

export interface CachedKeywordResult {
  selection: SelectionResult;
  keywordMode: KeywordMode;
  cached: boolean;
  costUsd: number;
  wallTimeS: number;
  fingerprint: string;
  fingerprintInputs: AnalysisFingerprintInputs;
  cacheDir: string;
  warnings: string[];
  rawText: string;
  promptVersion: number;
  model: string;
}

/**
 * Keyword analysis with the §6 cache in front of it. A hit costs nothing and
 * writes nothing to the ledger; a miss calls the model and records the actual
 * from `usageMetadata`.
 *
 * Two identical runs are byte-identical **because of the cache**, not because
 * the model is reproducible. Bypass the cache and the candidates can differ;
 * everything downstream of the candidates is deterministic, and that is the
 * only determinism claimed anywhere here.
 */
export async function analyseKeywordsCached(
  options: CachedKeywordOptions,
): Promise<CachedKeywordResult> {
  const {
    apiKey,
    videoSha256,
    durationS,
    words,
    mode,
    keywordMode,
    bypassCache = false,
    cacheRoot,
    log = (): void => undefined,
    runAnalysis = runKeywordAnalysis,
  } = options;

  const keywordCount = keywordCountFor(durationS);
  const candidateCount = candidateCountFor(keywordCount);
  const { ref, inputs } = analysisCacheRef({
    videoSha256,
    mode,
    words,
    candidateCount,
    cacheRoot,
  });

  const warnings: string[] = [];
  const finish = (payload: AnalysisCachePayload, cached: boolean): CachedKeywordResult => ({
    selection: selectKeywords(payload.candidates, words, keywordCount),
    keywordMode,
    cached,
    costUsd: cached ? 0 : payload.costUsd,
    wallTimeS: payload.wallTimeS,
    fingerprint: ref.fingerprint,
    fingerprintInputs: inputs,
    cacheDir: ref.dir,
    warnings,
    rawText: payload.rawText,
    promptVersion: payload.promptVersion,
    model: payload.model,
  });

  if (!bypassCache) {
    const { payload, warning } = await readAnalysisCache(ref);
    if (warning !== null) {
      warnings.push(warning);
      log(`cache: ${warning}`);
    }
    if (payload !== null) {
      log(`cache: hit ${ref.dir}`);
      return finish(payload, true);
    }
  }

  // runKeywordAnalysis appends the ledger line itself, at the point of spend.
  const result = await runAnalysis({ apiKey, words, mode, candidateCount });

  const payload = await writeAnalysisCache(ref, {
    rawText: result.rawText,
    candidates: result.candidates,
    costUsd: result.costUsd,
    wallTimeS: result.wallTimeS,
    promptVersion: result.promptVersion,
    model: result.model,
    modeId: mode.id,
    modeVersion: mode.version,
  });

  for (const dir of await evictStaleEntries(
    videoSha256,
    cacheRoot ?? CACHE_ROOT,
    MAX_ENTRIES_PER_VIDEO,
    ANALYSIS_CACHE_STAGE,
  )) {
    log(`cache: evicted stale entry ${dir}`);
  }

  return finish(payload, false);
}

export function slotCacheRef(options: {
  videoSha256: string;
  mode: ClientMode;
  words: AnalysisWord[];
  candidateCount: number;
  cacheRoot?: string;
}): { ref: CacheEntryRef; inputs: SlotFingerprintInputs } {
  const inputs = slotFingerprintInputs({
    mode: options.mode,
    words: options.words,
    candidateCount: options.candidateCount,
  });
  const fingerprint = slotFingerprintOf(inputs);
  return {
    inputs,
    ref: {
      dir: cacheEntryDir(
        options.videoSha256,
        SLOT_CACHE_STAGE,
        fingerprint,
        options.cacheRoot ?? CACHE_ROOT,
      ),
      videoSha256: options.videoSha256,
      stage: SLOT_CACHE_STAGE,
      fingerprint,
    },
  };
}

export interface CachedSlotOptions {
  apiKey: string;
  videoSha256: string;
  durationS: number;
  planId: string;
  words: AnalysisWord[];
  mode: ClientMode;
  bypassCache?: boolean;
  cacheRoot?: string;
  log?: (message: string) => void;
  /** Injected in tests so a hit can be exercised without an API key. */
  runAnalysis?: (options: {
    apiKey: string;
    words: AnalysisWord[];
    mode: ClientMode;
    candidateCount: number;
    durationS: number;
  }) => Promise<SlotAnalysisResult>;
}

export interface CachedSlotResult {
  selection: SlotSelectionResult;
  cached: boolean;
  costUsd: number;
  wallTimeS: number;
  fingerprint: string;
  cacheDir: string;
  warnings: string[];
  promptVersion: number;
  model: string;
}

/**
 * Image slot planning with the §6 cache in front of it. Mirrors
 * `analyseKeywordsCached` exactly, including that a hit costs nothing, writes
 * no ledger line, and is byte-identical only because of the cache.
 */
export async function planSlotsCached(options: CachedSlotOptions): Promise<CachedSlotResult> {
  const {
    apiKey,
    videoSha256,
    durationS,
    planId,
    words,
    mode,
    bypassCache = false,
    cacheRoot,
    log = (): void => undefined,
    runAnalysis = runSlotAnalysis,
  } = options;

  const slotCount = imageSlotCountFor(durationS);
  const candidateCount = slotCandidateCountFor(slotCount);
  const { ref } = slotCacheRef({ videoSha256, mode, words, candidateCount, cacheRoot });

  const warnings: string[] = [];
  const finish = (payload: SlotCachePayload, cached: boolean): CachedSlotResult => ({
    selection: planSlots({
      candidates: payload.candidates,
      words,
      mode,
      planId,
      requestedCount: slotCount,
      durationS,
    }),
    cached,
    costUsd: cached ? 0 : payload.costUsd,
    wallTimeS: payload.wallTimeS,
    fingerprint: ref.fingerprint,
    cacheDir: ref.dir,
    warnings,
    promptVersion: payload.promptVersion,
    model: payload.model,
  });

  if (!bypassCache) {
    const { payload, warning } = await readSlotCache(ref);
    if (warning !== null) {
      warnings.push(warning);
      log(`cache: ${warning}`);
    }
    if (payload !== null) {
      log(`cache: hit ${ref.dir}`);
      return finish(payload, true);
    }
  }

  // runSlotAnalysis appends the ledger line itself, at the point of spend.
  const result = await runAnalysis({ apiKey, words, mode, candidateCount, durationS });

  const payload = await writeSlotCache(ref, {
    rawText: result.rawText,
    candidates: result.candidates,
    costUsd: result.costUsd,
    wallTimeS: result.wallTimeS,
    promptVersion: result.promptVersion,
    model: result.model,
    modeId: mode.id,
    modeVersion: mode.version,
  });

  for (const dir of await evictStaleEntries(
    videoSha256,
    cacheRoot ?? CACHE_ROOT,
    MAX_ENTRIES_PER_VIDEO,
    SLOT_CACHE_STAGE,
  )) {
    log(`cache: evicted stale entry ${dir}`);
  }

  return finish(payload, false);
}
