import { createHash } from 'node:crypto';
import { modelConfig, type ClientMode } from '@framopia/core';
import { ACTIVE_ANALYSIS_PROMPT_VERSION, type AnalysisPromptVersion } from './keywords.js';
import { ACTIVE_SLOT_PROMPT_VERSION, type SlotPromptVersion } from './slots.js';
import type { AnalysisWord } from './types.js';

/**
 * Mirrors transcription/fingerprint.ts rather than inventing a second scheme:
 * same hash, same truncation, same fixed field order, same rule that anything
 * capable of changing the answer has to key.
 *
 * The transcript keys by content, not by video hash. The video hash already
 * groups the cache directory, but two prompt versions of the transcription
 * stage produce two different transcripts for one video, and an analysis of
 * the first must not be served for the second.
 */
export interface AnalysisFingerprintInputs {
  promptVersion: AnalysisPromptVersion;
  geminiModel: string;
  modeId: string;
  /** A mode version bump invalidates: the prompt carries mode context. */
  modeVersion: number;
  transcriptHash: string;
  candidateCount: number;
}

/**
 * Hashes what the prompt actually sees: the id and text of every word that is
 * not removed, in order. A word whose `removed` flag flips changes this, which
 * is correct — it changes the transcript the model is shown.
 */
export function hashTranscript(words: AnalysisWord[]): string {
  const canonical = JSON.stringify(
    words.filter((w) => !w.removed).map((w) => [w.id, w.text]),
  );
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

export function analysisFingerprintInputs(options: {
  mode: ClientMode;
  words: AnalysisWord[];
  candidateCount: number;
  promptVersion?: AnalysisPromptVersion;
}): AnalysisFingerprintInputs {
  return {
    promptVersion: options.promptVersion ?? ACTIVE_ANALYSIS_PROMPT_VERSION,
    geminiModel: modelConfig.geminiModel,
    modeId: options.mode.id,
    modeVersion: options.mode.version,
    transcriptHash: hashTranscript(options.words),
    candidateCount: options.candidateCount,
  };
}

export function analysisFingerprintOf(inputs: AnalysisFingerprintInputs): string {
  const canonical = JSON.stringify([
    inputs.promptVersion,
    inputs.geminiModel,
    inputs.modeId,
    inputs.modeVersion,
    inputs.transcriptHash,
    inputs.candidateCount,
  ]);
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

/**
 * The slot stage keys on the same things for the same reasons: its prompt
 * version, the model pin, the mode identity (its style fragments and
 * variation axes both reach the composed prompt) and the transcript.
 */
export interface SlotFingerprintInputs {
  promptVersion: SlotPromptVersion;
  geminiModel: string;
  modeId: string;
  modeVersion: number;
  transcriptHash: string;
  candidateCount: number;
}

export function slotFingerprintInputs(options: {
  mode: ClientMode;
  words: AnalysisWord[];
  candidateCount: number;
  promptVersion?: SlotPromptVersion;
}): SlotFingerprintInputs {
  return {
    promptVersion: options.promptVersion ?? ACTIVE_SLOT_PROMPT_VERSION,
    geminiModel: modelConfig.geminiModel,
    modeId: options.mode.id,
    modeVersion: options.mode.version,
    transcriptHash: hashTranscript(options.words),
    candidateCount: options.candidateCount,
  };
}

export function slotFingerprintOf(inputs: SlotFingerprintInputs): string {
  const canonical = JSON.stringify([
    inputs.promptVersion,
    inputs.geminiModel,
    inputs.modeId,
    inputs.modeVersion,
    inputs.transcriptHash,
    inputs.candidateCount,
  ]);
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}
