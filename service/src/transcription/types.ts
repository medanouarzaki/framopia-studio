export interface TranscriptWord {
  text: string;
  /** Seconds from the start of the audio. Null when no timing is known. */
  start: number | null;
  end: number | null;
  /** (0, 1] where the engine reports one, null where it does not. */
  confidence: number | null;
  /**
   * The draft token this word anchored to, where it anchored to one.
   *
   * Carried from the aligner rather than looked up by index: the correction
   * pass inserts and merges words, so the corrected list and the draft list do
   * not share an index. Undefined on an interpolated word, which had no
   * anchor and therefore no raw ASR form to keep.
   */
  sourceText?: string;
}

export type TranscriptionStage = 'scribe' | 'correction' | 'align';

/**
 * The non-fatal half of the ARCHITECTURE §8 channel: same stage/cause shape
 * as TranscriptionError, surfaced alongside a result instead of replacing it.
 * A warning never suppresses output — the panel shows both.
 */
export interface TranscriptionWarning {
  stage: TranscriptionStage;
  cause: string;
}

/**
 * Structured per ARCHITECTURE §8: the panel shows stage, cause and whether a
 * retry is worth offering, verbatim. Nothing in this module degrades
 * silently, so every failure path throws one of these.
 */
export class TranscriptionError extends Error {
  constructor(
    readonly stage: TranscriptionStage,
    readonly cause_: string,
    readonly retryable: boolean,
    readonly status?: number,
  ) {
    super(`${stage} failed: ${cause_}`);
    this.name = 'TranscriptionError';
  }
}
