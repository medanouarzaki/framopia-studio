import { alignCorrectedOntoDraft } from './align.js';
import { correctTranscript } from './correction.js';
import { transcribeWithScribe } from './scribe.js';
import type { TranscriptWord } from './types.js';

export interface HybridTranscribeOptions {
  elevenLabsApiKey: string;
  googleApiKey: string;
  audioPath: string;
  /** Mode vocabulary, passed to Scribe as keyterms and named in the prompt. */
  keyterms?: string[];
  guidePath?: string;
}

export interface HybridTranscript {
  words: TranscriptWord[];
  /** The uncorrected Scribe pass, kept so a reviewer can see what changed. */
  draftWords: TranscriptWord[];
  promptVersion: number;
  model: string;
  costUsd: number;
  wallTimeS: number;
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
  const { elevenLabsApiKey, googleApiKey, audioPath, keyterms = [], guidePath } = options;

  const scribe = await transcribeWithScribe({ apiKey: elevenLabsApiKey, audioPath, keyterms });

  const correction = await correctTranscript({
    apiKey: googleApiKey,
    audioPath,
    draftWords: scribe.words,
    keyterms,
    guidePath,
  });

  return {
    words: alignCorrectedOntoDraft(scribe.words, correction.correctedTexts),
    draftWords: scribe.words,
    promptVersion: correction.promptVersion,
    model: correction.model,
    // Scribe's cost is billed per audio-hour and is not known from the
    // response, so the caller adds it alongside the duration it already has.
    costUsd: correction.costUsd,
    wallTimeS: scribe.wallTimeS + correction.wallTimeS,
  };
}

export { alignCorrectedOntoDraft } from './align.js';
export {
  buildCorrectionPrompt,
  correctTranscript,
  parseCorrectionResponseText,
  PROMPT_VERSION,
} from './correction.js';
export { mapScribeResponse, transcribeWithScribe } from './scribe.js';
export { TranscriptionError, type TranscriptionStage, type TranscriptWord } from './types.js';
