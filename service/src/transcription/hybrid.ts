import { appendCost, estimateGeminiCallCost, estimateScribeCost } from '@framopia/core';
import { alignCorrectedOntoDraft } from './align.js';
import { computeHybridCost, type HybridCostBreakdown } from './cost.js';
import { correctTranscript, type CorrectionResult, type PromptVersion } from './correction.js';
import { driftWarning, measureTokenDrift, type TokenDrift } from './drift.js';
import { transcribeWithScribe, type ScribeResult } from './scribe.js';
import type { TranscriptionWarning, TranscriptWord } from './types.js';

export const SCRIBE_LEDGER_STAGE = 'transcribe-scribe';
export const CORRECTION_LEDGER_STAGE = 'transcribe-gemini-correction';

export interface HybridTranscribeOptions {
  elevenLabsApiKey: string;
  googleApiKey: string;
  audioPath: string;
  /** Audio duration in seconds. Required: Scribe bills per audio-hour and
   * its response does not carry one, so without it the cost is unknowable. */
  durationS: number;
  /** Mode vocabulary, passed to Scribe as keyterms and named in the prompt. */
  keyterms?: string[];
  guidePath?: string;
  version?: PromptVersion;
  /** Where the pre-flight estimate goes. Defaults to stdout. */
  log?: (message: string) => void;
}

export interface HybridTranscript {
  words: TranscriptWord[];
  /** The uncorrected Scribe pass, kept so a reviewer can see what changed. */
  draftWords: TranscriptWord[];
  promptVersion: PromptVersion;
  model: string;
  cost: HybridCostBreakdown;
  wallTimeS: number;
  drift: TokenDrift;
  /** Non-fatal problems. A flagged result is still a returned result. */
  warnings: TranscriptionWarning[];
  /** Kept so the cache can store and replay exactly what the APIs returned. */
  scribeRaw: unknown;
  correctionRaw: { text: string; usageMetadata: unknown };
  /** True when nothing was billed because the artifacts came from cache. */
  cached: boolean;
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
  const {
    elevenLabsApiKey,
    googleApiKey,
    audioPath,
    durationS,
    keyterms = [],
    guidePath,
    version,
    log = console.log,
  } = options;

  const scribeEstimate = estimateScribeCost(durationS, keyterms.length > 0);
  const geminiEstimate = estimateGeminiCallCost(durationS);
  log(
    `Estimated cost for ${durationS.toFixed(1)}s of audio: scribe $${scribeEstimate.toFixed(4)} (exact) + gemini correction $${geminiEstimate.toFixed(4)} (rough) = $${(scribeEstimate + geminiEstimate).toFixed(4)}`,
  );

  const scribe = await transcribeWithScribe({ apiKey: elevenLabsApiKey, audioPath, keyterms });

  const correction = await correctTranscript({
    apiKey: googleApiKey,
    audioPath,
    draftWords: scribe.words,
    keyterms,
    guidePath,
    version,
  });

  const result = assembleHybridResult(scribe, correction, durationS, keyterms.length > 0);

  // Both legs are billable and both are recorded (ARCHITECTURE §8). Written
  // after the calls return, so a failed call is never billed to the ledger.
  appendCost({
    stage: SCRIBE_LEDGER_STAGE,
    model: 'scribe_v2',
    unit: 'run',
    usd: result.cost.scribeUsd,
  });
  appendCost({
    stage: CORRECTION_LEDGER_STAGE,
    model: result.model,
    unit: 'run',
    usd: result.cost.geminiUsd,
  });

  return result;
}

/**
 * The pure half of transcribeHybrid: everything that happens once both calls
 * have returned. Split out so alignment, drift and cost assembly are testable
 * without reaching an API.
 */
export function assembleHybridResult(
  scribe: ScribeResult,
  correction: CorrectionResult,
  durationS: number,
  keytermsUsed = false,
): HybridTranscript {
  const drift = measureTokenDrift(scribe.words.length, correction.correctedTexts.length);
  const warning = driftWarning(drift);

  return {
    words: alignCorrectedOntoDraft(scribe.words, correction.correctedTexts),
    draftWords: scribe.words,
    promptVersion: correction.promptVersion,
    model: correction.model,
    cost: computeHybridCost(durationS, keytermsUsed, correction.usage),
    wallTimeS: scribe.wallTimeS + correction.wallTimeS,
    drift,
    warnings: warning === null ? [] : [warning],
    scribeRaw: scribe.raw,
    correctionRaw: { text: correction.rawText, usageMetadata: correction.usage },
    cached: false,
  };
}
