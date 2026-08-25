export const EDIT_PLAN_SCHEMA_VERSION = 1;

export type StageStatus = 'pending' | 'running' | 'done' | 'error';

export interface PipelineStage {
  status: StageStatus;
  config: string | null;
  costUsd: number | null;
  cached: boolean | null;
  completedAt: string | null;
  error: string | null;
}

/** The five stages ARCHITECTURE §3 names, in the order it names them. */
export const PIPELINE_STAGES = [
  'transcription',
  'analysis',
  'images',
  'zones',
  'build',
] as const;

export type PipelineStageName = (typeof PIPELINE_STAGES)[number];

export type Pipeline = Record<PipelineStageName, PipelineStage>;

export interface PlanMeta {
  /** Stable per source video. */
  id: string;
  createdAt: string;
  updatedAt: string;
  appVersion: string;
}

export interface PlanSource {
  videoPath: string;
  /** Cache key root. */
  sha256: string;
  durationS: number;
  fps: number;
  width: number;
  height: number;
  /** 16-bit PCM mono 16 kHz, extracted for ASR. */
  audioPath: string;
}

export interface ClientMode {
  id: string;
  version: number;
  path: string;
}

export type WordLang = 'darija' | 'msa' | 'fr' | 'en' | 'mixed';
export type WordScript = 'latin' | 'arabic';
export type RemovedReason = 'filler' | 'stutter' | 'falseStart';

export interface PlanWord {
  id: string;
  /** Seconds. Word timings are the single timing authority (§3 rules). */
  start: number;
  end: number;
  /** Display form: post-correction, post-orthography. */
  text: string;
  /** Raw ASR form, kept for audit and diff. */
  sourceText: string;
  /**
   * Null where no stage has determined the language. Prompt version 3 reports
   * it for every word, so null now means a model omission or a cache entry
   * written before version 3 existed — it stays representable because the
   * alternative is filling it with a guess, and it is not derivable from the
   * characters.
   */
  lang: WordLang | null;
  script: WordScript;
  confidence: number | null;
  /** Cleaning marks never delete a word; they mark it. */
  removed: boolean;
  removedReason: RemovedReason | null;
  /** True once a human touched it. */
  edited: boolean;
  /**
   * Set only when the model's `lang` and the local derivation disagree, so a
   * reviewer can find those words. Not in ARCHITECTURE §3: the schema has no
   * place to say "these two sources conflict", and silently preferring one
   * would throw away the only signal that either might be wrong. The
   * derivation itself is not stored — it is recomputable from the text.
   */
  langDisagreement?: boolean;
}

export interface Transcript {
  words: PlanWord[];
  /**
   * Departure from ARCHITECTURE §3, which does not name this field. Every
   * downstream block references transcript word ids, and a re-run has to be
   * able to tell whether those references still mean anything without
   * diffing two word arrays. Absent on a plan written before Block 3
   * session 4; a merge recomputes it from the words rather than assuming
   * such a plan is stale.
   */
  contentHash?: string;
}

export interface SubtitleGroup {
  id: string;
  wordIds: string[];
  /** Derived from the words, and re-derivable after a transcript edit. */
  start: number;
  end: number;
  templateId: string | null;
}

export interface Subtitles {
  groups: SubtitleGroup[];
}

export interface KeywordItem {
  id: string;
  wordIds: string[];
  text: string;
  score: number;
  reason: string;
  approved: boolean;
  templateId: string | null;
  start: number;
  end: number;
  /**
   * True once a human touched it, mirroring `PlanWord.edited`. ARCHITECTURE
   * §3 rules say an automated re-run must never overwrite a flagged item
   * without explicit confirmation, and keywords had no way to carry that
   * flag. Optional, so plans written before Block 3 session 4 stay valid.
   */
  edited?: boolean;
}

export interface Keywords {
  mode: 'auto' | 'propose';
  items: KeywordItem[];
}

export interface ImageCandidate {
  id: string;
  path: string;
  cutoutPath: string | null;
  cutoutQuality: number | null;
}

export interface ImageSlot {
  id: string;
  start: number;
  end: number;
  contextText: string;
  idea: string;
  prompt: string;
  negativePrompt: string;
  candidates: ImageCandidate[];
  chosenCandidateId: string | null;
  /** Quality-gate outcome, editor-overridable. */
  presentation: 'cutout' | 'card';
  zoneId: string | null;
  templateId: string | null;
  status: 'pending' | 'generated' | 'approved';
}

export interface Images {
  slots: ImageSlot[];
}

export interface ZoneRect {
  /** Normalized 0-1 against the frame. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Zone {
  id: string;
  kind: 'top' | 'left' | 'right';
  rect: ZoneRect;
  /** Time windows where the zone is actually free, as [startS, endS] pairs. */
  valid: [number, number][];
  /** True when an editor adjusted it. */
  manual: boolean;
}

export interface Zones {
  sampleFps: number;
  zones: Zone[];
}

export interface SfxEvent {
  id: string;
  /** The element that triggered it. */
  sourceElementId: string;
  sfxId: string;
  timeS: number;
  gainDb: number;
}

/** Generated, never hand-authored: recomputed on every build (§3 rules). */
export interface Sfx {
  events: SfxEvent[];
}

export interface Watermark {
  assetPath: string;
  startS: number;
  /** Filled at Block 7 from the real file. */
  durationS: number | null;
}

export interface Costs {
  totalUsd: number;
  byStage: Record<string, number>;
}

export interface Build {
  status: 'none' | 'built' | 'stale';
  aepPath: string | null;
  builtAt: string | null;
}

export interface EditPlan {
  schemaVersion: number;
  meta: PlanMeta;
  source: PlanSource;
  /** Null until a mode is chosen; transcription runs before that. */
  clientMode: ClientMode | null;
  pipeline: Pipeline;
  transcript: Transcript;
  subtitles: Subtitles;
  keywords: Keywords;
  images: Images;
  zones: Zones;
  sfx: Sfx;
  watermark: Watermark | null;
  costs: Costs;
  build: Build;
}
