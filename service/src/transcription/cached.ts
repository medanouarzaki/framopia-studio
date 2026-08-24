import { alignCorrectedOntoDraft } from './align.js';
import {
  cacheEntryDir,
  evictStaleEntries,
  readTranscriptionCache,
  writeTranscriptionCache,
  CACHE_ROOT,
  type CacheEntryRef,
} from './cache.js';
import { driftWarning, measureTokenDrift } from './drift.js';
import {
  fingerprintOf,
  transcriptionFingerprintInputs,
  type FingerprintInputs,
} from './fingerprint.js';
import { mapScribeResponse, type ScribeRawResponse } from './scribe.js';
import { transcribeHybrid, type HybridTranscribeOptions, type HybridTranscript } from './hybrid.js';
import type { TranscriptionWarning } from './types.js';

export const TRANSCRIPTION_CACHE_STAGE = 'transcription';

export interface CachedTranscribeOptions extends HybridTranscribeOptions {
  videoSha256: string;
  /** Opt-in only. A bypassed run still repopulates the entry it skipped. */
  bypassCache?: boolean;
  cacheRoot?: string;
  /** Injected in tests so a hit can be exercised without an API key. */
  runHybrid?: (options: HybridTranscribeOptions) => Promise<HybridTranscript>;
}

export interface CachedTranscribeResult {
  transcript: HybridTranscript;
  fingerprint: string;
  fingerprintInputs: FingerprintInputs;
  cacheDir: string;
}

export async function transcriptionCacheRef(options: {
  videoSha256: string;
  keyterms?: string[];
  guidePath?: string;
  cacheRoot?: string;
}): Promise<{ ref: CacheEntryRef; inputs: FingerprintInputs }> {
  const inputs = await transcriptionFingerprintInputs({
    keyterms: options.keyterms,
    guidePath: options.guidePath,
  });
  const fingerprint = fingerprintOf(inputs);
  return {
    inputs,
    ref: {
      dir: cacheEntryDir(
        options.videoSha256,
        TRANSCRIPTION_CACHE_STAGE,
        fingerprint,
        options.cacheRoot ?? CACHE_ROOT,
      ),
      videoSha256: options.videoSha256,
      stage: TRANSCRIPTION_CACHE_STAGE,
      fingerprint,
    },
  };
}

/**
 * Transcription with the §6 cache in front of it. A hit costs nothing and
 * writes nothing to the ledger; a miss runs the real thing, which records its
 * own actuals, and then stores the artifacts.
 */
export async function transcribeHybridCached(
  options: CachedTranscribeOptions,
): Promise<CachedTranscribeResult> {
  const {
    videoSha256,
    bypassCache = false,
    cacheRoot,
    runHybrid = transcribeHybrid,
    log = console.log,
    ...hybridOptions
  } = options;

  const { ref, inputs } = await transcriptionCacheRef({
    videoSha256,
    keyterms: hybridOptions.keyterms,
    guidePath: hybridOptions.guidePath,
    cacheRoot,
  });

  const warnings: TranscriptionWarning[] = [];

  if (!bypassCache) {
    const { payload, warning } = await readTranscriptionCache(ref);
    if (warning !== null) {
      log(`cache: ${warning}`);
      warnings.push({ stage: 'scribe', cause: warning });
    }
    if (payload !== null) {
      log(`cache hit: ${ref.dir} — no billable calls`);
      const draftWords = mapScribeResponse(payload.scribeRaw as ScribeRawResponse);
      const drift = measureTokenDrift(draftWords.length, payload.correctedTexts.length);
      const driftWarn = driftWarning(drift);
      return {
        fingerprint: ref.fingerprint,
        fingerprintInputs: inputs,
        cacheDir: ref.dir,
        transcript: {
          words: alignCorrectedOntoDraft(draftWords, payload.correctedTexts),
          draftWords,
          promptVersion: payload.promptVersion as HybridTranscript['promptVersion'],
          model: payload.model,
          cost: payload.costUsd,
          wallTimeS: payload.wallTimeS,
          drift,
          warnings: driftWarn === null ? warnings : [...warnings, driftWarn],
          scribeRaw: payload.scribeRaw,
          correctionRaw: payload.correctionRaw,
          cached: true,
        },
      };
    }
  }

  const transcript = await runHybrid({ ...hybridOptions, log });

  await writeTranscriptionCache(ref, {
    audioPath: hybridOptions.audioPath,
    durationS: hybridOptions.durationS,
    scribeRaw: transcript.scribeRaw,
    correctionRaw: transcript.correctionRaw,
    correctedTexts: transcript.words.map((w) => w.text),
    costUsd: transcript.cost,
    wallTimeS: transcript.wallTimeS,
    promptVersion: transcript.promptVersion,
    model: transcript.model,
  });

  for (const dir of await evictStaleEntries(videoSha256, cacheRoot ?? CACHE_ROOT)) {
    log(`cache: evicted stale entry ${dir}`);
  }

  return {
    fingerprint: ref.fingerprint,
    fingerprintInputs: inputs,
    cacheDir: ref.dir,
    transcript: { ...transcript, warnings: [...warnings, ...transcript.warnings] },
  };
}
