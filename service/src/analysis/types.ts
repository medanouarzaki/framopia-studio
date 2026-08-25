/** A failure in the analysis stage, shaped like TranscriptionError. */
export class AnalysisError extends Error {
  constructor(
    readonly stage: 'keywords',
    readonly cause: string,
    readonly retryable: boolean,
  ) {
    super(`analysis ${stage} failed: ${cause}`);
    this.name = 'AnalysisError';
  }
}

/** What the model returns per candidate, before any resolution or ranking. */
export interface KeywordCandidate {
  wordIds: string[];
  text: string;
  score: number;
  reason: string;
}

/** The subset of a plan word this stage reads. */
export interface AnalysisWord {
  id: string;
  text: string;
  start: number;
  end: number;
  removed: boolean;
}

export type KeywordMode = 'auto' | 'propose';

export interface ResolutionFailure {
  candidate: KeywordCandidate;
  reason:
    | 'unknown-word-id'
    | 'removed-word'
    | 'overlaps-a-selected-keyword'
    | 'shares-a-head-term'
    | 'empty-word-ids'
    | 'score-out-of-range';
}

/** A candidate the model returned longer than a template can carry. */
export interface NarrowedSpan {
  originalWordIds: string[];
  originalText: string;
  wordIds: string[];
  text: string;
}

export interface SelectionResult {
  items: {
    wordIds: string[];
    text: string;
    score: number;
    reason: string;
    start: number;
    end: number;
  }[];
  /** Every candidate that could not become a keyword, and why. */
  failures: ResolutionFailure[];
  /** Candidates whose own `text` disagreed with the words their ids name. */
  textMismatches: { wordIds: string[]; modelText: string; planText: string }[];
  /** Imposed by keywordCountFor, never chosen by the model. */
  requestedCount: number;
  /** Candidates the span cap shortened, with what they were. */
  narrowed: NarrowedSpan[];
  /**
   * How many keywords the count asked for and diversity could not supply.
   * Reported, never padded: a second keyword on the same idea is worse than
   * one fewer emphasis moment.
   */
  shortfall: number;
}
