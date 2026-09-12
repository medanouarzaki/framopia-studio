import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
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
import { reaskSlotIdea } from './slots.js';
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
  /** Spans this reel has already bought a picture for, as `wordIds.join(" ")`. */
  alreadyBought?: readonly string[];
  /** This client's already-paid-for ideas, normalised. Never another's. */
  ownedIdeas?: ReadonlySet<string>;
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
  // The video is handed to it rather than recorded here, so the line that says
  // which reel the money was for is written where the money is spent.
  const result = await runAnalysis({ apiKey, words, mode, candidateCount, videoSha256 });

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
  /** Spans this reel has already bought a picture for, as the joined word ids. */
  alreadyBought?: readonly string[];
  /** This client's already-paid-for ideas, normalised. Never another's. */
  ownedIdeas?: ReadonlySet<string>;
  /**
   * Injected in tests, so the re-ask cannot reach a real model.
   *
   * Without this the stranger test in `a-stranger.test.ts` called Gemini for
   * real the moment its recorded answer held a bad idea — found by it hanging
   * for five seconds against a live endpoint.
   */
  runReask?: typeof reaskSlotIdea;
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
/** Where the span of a refused idea is found, so the re-ask names the moment. */
function spanOf(payload: SlotCachePayload, idea: string): string[] | null {
  const hit = payload.candidates.find((c) => c.idea === idea);
  return hit === undefined ? null : [...hit.wordIds];
}

/**
 * Re-asked ideas, beside the cached response rather than inside it.
 *
 * The response is what the model said and what was paid for; editing it would
 * lose that. This records what was asked again and what came back, so a re-run
 * is free and a person can see both.
 */
const REASK_FILE = 'reasked-ideas.json';

async function readReasks(ref: { dir: string }): Promise<Record<string, string>> {
  try {
    return JSON.parse(await readFile(path.join(ref.dir, REASK_FILE), 'utf8')) as Record<
      string,
      string
    >;
  } catch {
    return {};
  }
}

async function writeReasks(ref: { dir: string }, answers: Record<string, string>): Promise<void> {
  await mkdir(ref.dir, { recursive: true });
  await writeFile(path.join(ref.dir, REASK_FILE), `${JSON.stringify(answers, null, 2)}\n`, 'utf8');
}

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
    runReask = reaskSlotIdea,
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
      alreadyBought: options.alreadyBought,
      ownedIdeas: options.ownedIdeas,
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
      return await withRetries(finish(payload, true), payload, true);
    }
  }

  /**
   * **One weak idea must not kill the reel.**
   *
   * Block 12 session 89: `sora-2`'s analysis returned twelve ideas, eleven of
   * them fine, and the seventh named a group. The run stopped and nothing was
   * built. `planSlots` no longer throws for that — it drops the idea and names
   * it — and this asks the model again for the one it dropped, saying what was
   * wrong, keeping the eleven.
   *
   * **Two attempts in total: the first and one retry.** The bound is about
   * money, not about how well a second nudge works, which is unmeasured. A run's
   * price is quoted before it starts from `imageSlotCountFor`; every retry is a
   * call that was not in that quote, and one retry per refused idea is a worst
   * case that can be stated in advance. What makes the run safe is not the
   * retry — it is that **a slot with no usable idea after its retries simply
   * gets no picture and the run continues**. The retry is a best effort on top
   * of that.
   *
   * Answers are written beside the cached response rather than into it, so the
   * paid-for original is never edited and a re-run costs nothing.
   */
  async function withRetries(
    selection: CachedSlotResult,
    payload: SlotCachePayload,
    cached: boolean,
  ): Promise<CachedSlotResult> {
    if (selection.selection.rejected.length === 0) return selection;

    const answered = await readReasks(ref);
    let current = selection;
    let spentUsd = 0;

    for (const issue of current.selection.rejected) {
      const span = spanOf(payload, issue.idea);
      if (span === null) continue;
      const key = span.join(' ');

      let replacement: string | undefined = answered[key];
      if (replacement === undefined) {
        log(
          `slots: "${issue.idea}" names more than one thing ("${issue.marker}") — ` +
            'asking again for this moment',
        );
        const again = await runReask({
          apiKey,
          words,
          mode,
          wordIds: span,
          idea: issue.idea,
          marker: issue.marker,
          videoSha256,
        });
        spentUsd += again.costUsd;
        replacement = again.idea;
        answered[key] = replacement;
        await writeReasks(ref, answered);
      }
      log(
        replacement === ''
          ? `slots: nothing came back for that moment, so it gets no picture`
          : `slots: it came back as "${replacement}"`,
      );
    }

    const amended = payload.candidates.map((candidate) => {
      const replacement = answered[candidate.wordIds.join(' ')];
      return replacement === undefined || replacement === ''
        ? candidate
        : { ...candidate, idea: replacement };
    });
    current = finish({ ...payload, candidates: amended }, cached);
    for (const issue of current.selection.rejected) {
      log(`slots: "${issue.idea}" still names more than one thing, so that moment gets no picture`);
    }
    return { ...current, costUsd: current.costUsd + spentUsd };
  }

  // runSlotAnalysis appends the ledger line itself, at the point of spend.
  const result = await runAnalysis({ apiKey, words, mode, candidateCount, durationS, videoSha256 });

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

  return await withRetries(finish(payload, false), payload, false);
}
