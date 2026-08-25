import { createHash } from 'node:crypto';
import {
  keywordModeContentHash,
  modelConfig,
  slotModeContentHash,
  type ClientMode,
} from '@framopia/core';
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
  /**
   * A content hash of the mode fields the keyword call reads, not the mode
   * version. Session 3 bumped the mode for a variation-axis change this call
   * never sees and invalidated every entry; a font at Block 9 would too.
   */
  modeHash: string;
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
    modeHash: keywordModeContentHash(options.mode),
    transcriptHash: hashTranscript(options.words),
    candidateCount: options.candidateCount,
  };
}

export function analysisFingerprintOf(inputs: AnalysisFingerprintInputs): string {
  const canonical = JSON.stringify([
    inputs.promptVersion,
    inputs.geminiModel,
    inputs.modeId,
    inputs.modeHash,
    inputs.transcriptHash,
    inputs.candidateCount,
  ]);
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

/**
 * The slot stage keys on the same things for the same reasons: its prompt
 * version, the model pin, the mode fields **its own call** reads, and the
 * transcript.
 *
 * Its mode hash is narrower than the keyword one — the slot prompt reads the
 * client name and nothing else. The style fragments and variation axes reach
 * the composed prompt, but composition is pure and free, so keying a billed
 * call on them would pay for an edit the model never saw.
 */
export interface SlotFingerprintInputs {
  promptVersion: SlotPromptVersion;
  geminiModel: string;
  modeId: string;
  modeHash: string;
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
    modeHash: slotModeContentHash(options.mode),
    transcriptHash: hashTranscript(options.words),
    candidateCount: options.candidateCount,
  };
}

export function slotFingerprintOf(inputs: SlotFingerprintInputs): string {
  const canonical = JSON.stringify([
    inputs.promptVersion,
    inputs.geminiModel,
    inputs.modeId,
    inputs.modeHash,
    inputs.transcriptHash,
    inputs.candidateCount,
  ]);
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}
