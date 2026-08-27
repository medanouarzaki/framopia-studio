import {
  listTranscriptionEntries,
  resolveCacheEntry,
  type ResolvedEntry,
} from '@framopia/core';
import { ACTIVE_PROMPT_VERSION } from './correction.js';
import { CACHE_ROOT } from './cache.js';
import {
  fingerprintOf,
  readGuideVersion,
  transcriptionFingerprintInputs,
} from './fingerprint.js';

/**
 * The one place anything asks "is this reel's transcription already on disk".
 *
 * The dry run, the runner and the diagnostics used to answer it two different
 * ways — `selectTranscriptionEntry` by prompt version, `transcribeHybridCached`
 * by computed fingerprint — and they disagreed for four blocks. The dry run
 * therefore reported `vitasilk` as fully cached and free while a real run would
 * have re-transcribed and billed. One resolver, one answer, and the answer
 * carries how it was reached.
 */
export async function resolveTranscriptionEntry(options: {
  videoSha256: string;
  keyterms?: string[];
  guidePath?: string;
  cacheRoot?: string;
}): Promise<ResolvedEntry> {
  const root = options.cacheRoot ?? CACHE_ROOT;
  const inputs = await transcriptionFingerprintInputs({
    keyterms: options.keyterms,
    guidePath: options.guidePath,
  });
  const guideVersion = await readGuideVersion(options.guidePath);

  return resolveCacheEntry({
    entries: listTranscriptionEntries(root, options.videoSha256),
    wantedFingerprint: fingerprintOf(inputs),
    wantedGuideVersion: guideVersion,
    wantedPromptVersion: ACTIVE_PROMPT_VERSION,
    fingerprintFor: (promptVersion, candidateGuide) =>
      fingerprintOf({
        ...inputs,
        promptVersion: promptVersion as typeof inputs.promptVersion,
        guideVersion: candidateGuide,
      }),
  });
}
