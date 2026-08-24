import { alignCorrectedOntoDraft } from './align.js';
import { correctTranscript, type CorrectionResult, type PromptVersion } from './correction.js';
import { driftWarning, measureTokenDrift, type TokenDrift } from './drift.js';
import { transcribeWithScribe, type ScribeResult } from './scribe.js';
import type { TranscriptionWarning, TranscriptWord } from './types.js';

export interface HybridTranscribeOptions {
  elevenLabsApiKey: string;
  googleApiKey: string;
  audioPath: string;
  /** Mode vocabulary, passed to Scribe as keyterms and named in the prompt. */
  keyterms?: string[];
  guidePath?: string;
  version?: PromptVersion;
}

export interface HybridTranscript {
  words: TranscriptWord[];
  /** The uncorrected Scribe pass, kept so a reviewer can see what changed. */
  draftWords: TranscriptWord[];
  promptVersion: PromptVersion;
  model: string;
  costUsd: number;
  wallTimeS: number;
  drift: TokenDrift;
  /** Non-fatal problems. A flagged result is still a returned result. */
  warnings: TranscriptionWarning[];
}

/**
 * The Block 1 frozen configuration: Scribe v2 for timings and a first pass,
 * a Gemini correction pass over audio + draft + the orthography guide, then
 * anchor alignment of the corrected text back onto Scribe's timings.
 *
 * There is no fallback path. If the correction pass fails this throws, per
 * ARCHITECTURE §8 — returning the Scribe draft would hand back Arabic-script
 * Darija labelled as a hybrid result, which is silent degradation of exactly
 * the kind the freeze exists to prevent.
 */
export async function transcribeHybrid(
  options: HybridTranscribeOptions,
): Promise<HybridTranscript> {
  const { elevenLabsApiKey, googleApiKey, audioPath, keyterms = [], guidePath, version } = options;

  const scribe = await transcribeWithScribe({ apiKey: elevenLabsApiKey, audioPath, keyterms });

  const correction = await correctTranscript({
    apiKey: googleApiKey,
    audioPath,
    draftWords: scribe.words,
    keyterms,
    guidePath,
    version,
  });

  return assembleHybridResult(scribe, correction);
}

/**
 * The pure half of transcribeHybrid: everything that happens once both calls
 * have returned. Split out so alignment, drift and cost assembly are testable
 * without reaching an API.
 */
export function assembleHybridResult(
  scribe: ScribeResult,
  correction: CorrectionResult,
): HybridTranscript {
  const drift = measureTokenDrift(scribe.words.length, correction.correctedTexts.length);
  const warning = driftWarning(drift);

  return {
    words: alignCorrectedOntoDraft(scribe.words, correction.correctedTexts),
    draftWords: scribe.words,
    promptVersion: correction.promptVersion,
    model: correction.model,
    // Scribe's cost is billed per audio-hour and is not known from the
    // response, so the caller adds it alongside the duration it already has.
    costUsd: correction.costUsd,
    wallTimeS: scribe.wallTimeS + correction.wallTimeS,
    drift,
    warnings: warning === null ? [] : [warning],
  };
}

export { alignCorrectedOntoDraft } from './align.js';
export {
  buildCorrectionPrompt,
  correctTranscript,
  parseCorrectionResponseText,
  ACTIVE_PROMPT_VERSION,
  type PromptVersion,
} from './correction.js';
export {
  driftWarning,
  measureTokenDrift,
  DRIFT_WARNING_THRESHOLD,
  type TokenDrift,
} from './drift.js';
export { mapScribeResponse, transcribeWithScribe } from './scribe.js';
export {
  TranscriptionError,
  type TranscriptionStage,
  type TranscriptionWarning,
  type TranscriptWord,
} from './types.js';
