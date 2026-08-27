import { existsSync } from 'node:fs';
import { alignCorrectedOntoDraft } from './align.js';
import {
  cacheEntryDir,
  evictStaleEntries,
  MAX_ENTRIES_PER_VIDEO,
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
import type { ResolvedEntry } from '@framopia/core';
import { resolveTranscriptionEntry } from './resolve-entry.js';
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
  /**
   * How the entry that produced this transcript was found, so the plan can
   * record it. `compatible` means an older orthography guide, reused
   * deliberately and never silently.
   */
  entry: ResolvedEntry;
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

  const entry = await resolveTranscriptionEntry({
    videoSha256,
    keyterms: hybridOptions.keyterms,
    guidePath: hybridOptions.guidePath,
    cacheRoot,
  });
  // Said before anything is spent, never discovered by being billed.
  log(`cache: ${entry.note}`);

  /**
   * The resolver lists entries by reading their manifests, so an entry whose
   * manifest is corrupt is invisible to it and resolves `none`. That would
   * report a damaged entry as an absent one and send the caller to the API
   * without saying why, so the exact directory is still read when it exists:
   * a corrupt entry is a miss **with its own warning**, which is what it was
   * before the resolver existed.
   */
  const readDir = entry.dir ?? (existsSync(ref.dir) ? ref.dir : null);

  if (!bypassCache && readDir !== null) {
    const { payload, warning } = await readTranscriptionCache({ ...ref, dir: readDir });
    if (warning !== null) {
      log(`cache: ${warning}`);
      warnings.push({ stage: 'scribe', cause: warning });
    }
    if (payload !== null) {
      log(`cache ${entry.provenance}: ${readDir} — no billable calls`);
      const draftWords = mapScribeResponse(payload.scribeRaw as ScribeRawResponse);
      const drift = measureTokenDrift(draftWords.length, payload.correctedTexts.length);
      const driftWarn = driftWarning(drift);
      return {
        fingerprint: ref.fingerprint,
        fingerprintInputs: inputs,
        cacheDir: readDir,
        entry,
        transcript: {
          words: alignCorrectedOntoDraft(draftWords, payload.correctedTexts),
          draftWords,
          promptVersion: payload.promptVersion as HybridTranscript['promptVersion'],
          model: payload.model,
          cost: payload.costUsd,
          wallTimeS: payload.wallTimeS,
          drift,
          warnings: driftWarn === null ? warnings : [...warnings, driftWarn],
          correctedWords:
            payload.correctedWords ?? payload.correctedTexts.map((text) => ({ text })),
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
    correctedWords: transcript.correctedWords,
    costUsd: transcript.cost,
    wallTimeS: transcript.wallTimeS,
    promptVersion: transcript.promptVersion,
    model: transcript.model,
  });

  for (const dir of await evictStaleEntries(
    videoSha256,
    cacheRoot ?? CACHE_ROOT,
    MAX_ENTRIES_PER_VIDEO,
    TRANSCRIPTION_CACHE_STAGE,
  )) {
    log(`cache: evicted stale entry ${dir}`);
  }

  return {
    fingerprint: ref.fingerprint,
    fingerprintInputs: inputs,
    cacheDir: ref.dir,
    // A run that transcribed wrote the exact entry, whatever the resolution
    // said before it ran.
    entry: {
      ...entry,
      provenance: 'exact',
      id: `${TRANSCRIPTION_CACHE_STAGE}-${ref.fingerprint}`,
      dir: ref.dir,
      promptVersion: transcript.promptVersion,
      entryGuideVersion: entry.wantedGuideVersion,
      note: `transcribed and cached at ${ref.fingerprint}`,
    },
    transcript: { ...transcript, warnings: [...warnings, ...transcript.warnings] },
  };
}
