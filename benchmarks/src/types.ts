export interface TranscribedWord {
  text: string;
  startS: number | null;
  endS: number | null;
  confidence: number | null;
}

export interface TranscriptionResult {
  engine: string;
  words: TranscribedWord[];
  rawResponsePath: string;
  costUsd: number;
  wallTimeS: number;
}

export type Lang = 'darija' | 'fr' | 'en' | 'msa';
export type Script = 'latin' | 'arabic';

export interface GroundTruthWord {
  text: string;
  lang: Lang;
  script: Script;
}

export interface GroundTruth {
  /**
   * Which revision of the reference this is. Absent on reels that have never
   * been revised. Block 1 learned that changing the reference silently moves
   * WER columns, so a scored result has to be able to name what it scored
   * against.
   */
  version?: string;
  words: GroundTruthWord[];
}
