import { existsSync } from 'node:fs';
import type { ClientMode, EntryProvenance } from '@framopia/core';
import { cacheEntryDir, CACHE_ROOT } from '../transcription/cache.js';
import { ANALYSIS_CACHE_STAGE, SLOT_CACHE_STAGE } from './cache.js';
import {
  analysisFingerprintInputs,
  analysisFingerprintOf,
  slotFingerprintInputs,
  slotFingerprintOf,
} from './fingerprint.js';
import { ACTIVE_ANALYSIS_PROMPT_VERSION, candidateCountFor } from './keywords.js';
import { keywordCountFor, imageSlotCountFor } from './count.js';
import { ACTIVE_SLOT_PROMPT_VERSION, slotCandidateCountFor } from './slots.js';
import type { AnalysisWord } from './types.js';

export interface ResolvedAnalysisEntry {
  provenance: EntryProvenance;
  id: string | null;
  dir: string | null;
  fingerprint: string;
  note: string;
}

/**
 * The analysis stages resolve `exact` or `none`, and **never `compatible`**.
 *
 * The compatible rule exists for one difference: an orthography guide version,
 * at an identical prompt version. The analysis fingerprint does not carry a
 * guide version at all, so the only way an analysis entry can differ is in the
 * prompt version, the mode content the call reads, the transcript, or the
 * candidate count — and every one of those changes the question the model was
 * asked.
 *
 * `test-1` and `vitasilk` hold keyword entries at analysis prompt version 3
 * while the active version is 4, and version 4 asks for §6 term boundaries
 * that version 3 was never asked for. Serving a v3 answer to a v4 question
 * would be presenting an answer to a different question as a cheaper version
 * of the right one. Those resolve `none`, and the dry run says a run would
 * bill.
 */
function resolve(
  stage: string,
  videoSha256: string,
  fingerprint: string,
  cacheRoot: string,
  describe: string,
): ResolvedAnalysisEntry {
  const dir = cacheEntryDir(videoSha256, stage, fingerprint, cacheRoot);
  const id = `${stage}-${fingerprint}`;
  if (existsSync(dir)) {
    return { provenance: 'exact', id, dir, fingerprint, note: `exact cache hit ${id}` };
  }
  return {
    provenance: 'none',
    id: null,
    dir: null,
    fingerprint,
    note: `no cache entry for fingerprint ${fingerprint} (${describe}); a run would call the model and bill`,
  };
}

export function resolveKeywordEntry(options: {
  videoSha256: string;
  mode: ClientMode;
  words: AnalysisWord[];
  durationS: number;
  cacheRoot?: string;
}): ResolvedAnalysisEntry {
  const candidateCount = candidateCountFor(keywordCountFor(options.durationS));
  const fingerprint = analysisFingerprintOf(
    analysisFingerprintInputs({ mode: options.mode, words: options.words, candidateCount }),
  );
  return resolve(
    ANALYSIS_CACHE_STAGE,
    options.videoSha256,
    fingerprint,
    options.cacheRoot ?? CACHE_ROOT,
    `analysis prompt v${ACTIVE_ANALYSIS_PROMPT_VERSION}, ${candidateCount} candidates`,
  );
}

export function resolveSlotEntry(options: {
  videoSha256: string;
  mode: ClientMode;
  words: AnalysisWord[];
  durationS: number;
  cacheRoot?: string;
}): ResolvedAnalysisEntry {
  const candidateCount = slotCandidateCountFor(imageSlotCountFor(options.durationS));
  const fingerprint = slotFingerprintOf(
    slotFingerprintInputs({ mode: options.mode, words: options.words, candidateCount }),
  );
  return resolve(
    SLOT_CACHE_STAGE,
    options.videoSha256,
    fingerprint,
    options.cacheRoot ?? CACHE_ROOT,
    `slot prompt v${ACTIVE_SLOT_PROMPT_VERSION}, ${candidateCount} candidates`,
  );
}
