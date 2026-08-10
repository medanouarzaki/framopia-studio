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
  words: GroundTruthWord[];
}
