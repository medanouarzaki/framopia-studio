/**
 * The service's wire shapes, declared once. The panel never invents a field:
 * anything it shows has to arrive from the service or from ExtendScript, per
 * ARCHITECTURE §1.1 — the panel is a view, never the place a decision lives.
 */
export interface ToolState {
  present: boolean;
  detail: string;
  /**
   * The absolute path the service actually ran, and how it found it. Optional
   * so an older service's payload still parses. `PATH` inside a Finder-launched
   * After Effects holds no Homebrew, so "present" without a path is a claim
   * with no evidence behind it.
   */
  path?: string;
  source?: string;
}

/**
 * How the panel reached this service: it started it, or it was already running.
 * A terminal-started service inherits a shell PATH and a panel-spawned one does
 * not, so the two can disagree about what this machine has — which is exactly
 * what happened with ffmpeg, invisibly, for a whole session.
 */
export type ServiceOrigin = 'spawned' | 'existing';

export interface HealthPayload {
  ok: boolean;
  serviceVersion: string;
  appVersion: string;
  promptVersion: number;
  ffmpeg: ToolState;
  ffprobe: ToolState;
  sidecar: { venv: ToolState; pythonPath: string };
  /** The service process that answered. Optional so an older payload parses. */
  process?: { pid: number; startedAt: string };
  templates: { valid: boolean; issues: string[]; count: number };
  /** Where the repo really is, so the panel need not derive it twice. */
  repoRoot: string;
  /**
   * Which Node is running the pipeline, and which source it resolved from.
   * Optional: a service older than this field must not blank the panel.
   */
  node?: { path: string | null; source: string | null; version?: string; help?: string };
}

/** How the cache answers for a stage right now. See core's entry-resolve. */
export type EntryProvenance = 'exact' | 'compatible' | 'none';

export interface DryRunStage {
  id: string;
  label: string;
  status: 'done' | 'pending';
  /**
   * What a run would actually do. `status` is what the plan remembers, which
   * is not the same question: a stage the plan calls `done` can still resolve
   * `none` and bill.
   */
  provenance: EntryProvenance | null;
  entryId: string | null;
  estimateUsd: number | null;
  /** What a run will do with this stage; the panel renders this, not a guess. */
  action: 'skip' | 'reuse' | 'run';
  note: string;
}

export interface DryRunPlan {
  reel: string;
  videoPath: string;
  modeId: string;
  modeName: string;
  modeVersion: number;
  planPath: string | null;
  spentUsd: number | null;
  stages: DryRunStage[];
  /** Whether this reel is built with the intro watermark. */
  watermark: boolean;
  /**
   * The client the plan itself records, and the version it was built at. Null
   * on a plan whose analysis has never run, which is the only honest answer:
   * nothing on disk says which client it belongs to.
   */
  planClientMode: { id: string; version: number } | null;
  estimateUsd: number;
  /** True when a stage reuses a transcription made against an older guide. */
  reusesOlderGuide: boolean;
}

/** ARCHITECTURE §8. Shown verbatim; the panel never paraphrases a cause. */
export interface ServiceError {
  error: string;
  stage: string;
  cause: string;
  retryable: boolean;
}

export interface Reel {
  label: string;
  videoPath: string;
  planPath: string | null;
  durationS: number | null;
  /** Cumulative spend from the plan's `costs.spentUsd`, or null when no plan exists yet. */
  spentUsd: number | null;
  /** False when the catalogue lists it but the file is not on this machine. */
  present?: boolean;
}

export interface ClientMode {
  id: string;
  name: string;
  version: number;
  fontsResolved: boolean;
  /** Present only when the mode names its own fonts. */
  fonts?: { latin: string; arabic: string };
}

export type ServiceState =
  | { kind: 'starting' }
  | { kind: 'healthy'; health: HealthPayload; origin: ServiceOrigin }
  | { kind: 'unreachable'; error: ServiceError };

/**
 * What the panel's environment turned out to be. A discriminated union rather
 * than a throw: an unavailable host is a state the screen renders, and the
 * screen cannot render if resolving the host killed the module.
 */
export type HostEnvironment =
  | {
      available: true;
      repo: string;
      /** Which mechanism found the repository, shown when something is wrong. */
      rootSource: string;
      host: import('./service.js').PanelHost;
      logoSrc: string | null;
    }
  | {
      available: false;
      /** The capability that is absent, named as the code names it. */
      missing: string;
      /** ARCHITECTURE §8: shown verbatim. */
      cause: string;
      /** What the user cannot do as a result, in plain words. */
      prevents: string;
    };

/** The five steps of the flow, in the order PROJECT_SPEC §6 lists them. */
export type StepId = 'reel' | 'transcript' | 'keywords' | 'images' | 'build';

export interface StepState {
  id: StepId;
  label: string;
  /** Whether the plan on disk supports opening this step. */
  available: boolean;
  reason: string | null;
  summary: string | null;
  /** Named, not counted: "5 buildability issue(s)" is not actionable. */
  issues?: string[];
}

/**
 * Step state as the service derived it from the Edit Plan. The panel renders
 * this and decides none of it: closing the panel or restarting After Effects
 * must land the user where the reel actually is, and only the plan survives
 * both.
 */
export interface PlanSteps {
  reel: string;
  planPath: string | null;
  steps: StepState[];
}

/** How a pipeline stage is going, as the service reports it. */
export type StageState = 'waiting' | 'running' | 'done' | 'skipped' | 'failed';

/** ARCHITECTURE §8: surfaced verbatim, never paraphrased. */
export interface PipelineStageError {
  stage: string;
  cause: string;
  retryable: boolean;
}

export interface PipelineStageReport {
  id: string;
  label: string;
  state: StageState;
  reason: string | null;
  costUsd: number;
  cacheEntryId: string | null;
  cacheProvenance: EntryProvenance | null;
  startedAt: string | null;
  finishedAt: string | null;
  error: PipelineStageError | null;
}

export interface PipelineProgress {
  reel: string;
  modeId: string;
  planPath: string | null;
  stages: PipelineStageReport[];
  percent: number;
  spentUsd: number;
  planSpentUsd: number | null;
  done: boolean;
  error: PipelineStageError | null;
}

/**
 * The job as `GET /jobs/:id` returns it. `detail` is the runner's progress,
 * which is absent until the first stage reports.
 */
export interface PipelineJob {
  id: string;
  status: 'pending' | 'running' | 'done' | 'error';
  progress: number;
  error?: string;
  detail?: PipelineProgress;
}

export interface TranscriptWordView {
  id: string;
  text: string;
  sourceText: string | null;
  start: number;
  end: number;
  script: 'latin' | 'arabic';
  lang: string | null;
  confidence: number | null;
  removed: boolean;
  removedReason: string | null;
  edited: boolean;
  cardId: string | null;
  interpolated: boolean;
}

export interface TranscriptCardView {
  id: string;
  wordIds: string[];
  start: number;
  end: number;
  displayStart: number | null;
  displayEnd: number | null;
  templateId: string | null;
  supersededBy: string | null;
  holdClipped: boolean;
  shortByS: number | null;
}

export interface QuestionInstance {
  wordIds: string[];
  text: string;
  detail: string;
  parts?: { cardId: string; text: string }[];
}

export interface OpenQuestion {
  id: 'overlong' | 'clipped' | 'split-term';
  label: string;
  question: string;
  basis: string;
  wordIds: string[];
  /** This reel. Never shown without saying so. */
  count: number;
  /** Every reel that has a plan. */
  corpusCount: number;
  /** True when the count stands in for a measurement it cannot take. */
  proxy: boolean;
  instances: QuestionInstance[];
}

export interface TranscriptView {
  reel: string;
  planPath: string;
  words: TranscriptWordView[];
  cards: TranscriptCardView[];
  questions: OpenQuestion[];
  editCost: string;
  transcriptHash: string;
}

export interface KeywordView {
  id: string;
  wordIds: string[];
  text: string;
  cardId: string | null;
  start: number;
  end: number;
  reason: string;
  score: number;
  kind: 'label' | 'promise' | null;
  script: 'latin' | 'arabic';
  templateId: string | null;
  fontSize: number;
  edited: boolean;
}

export interface PromotableWord {
  wordId: string;
  text: string;
  cardId: string | null;
  script: 'latin' | 'arabic';
  start: number;
  end: number;
}

export interface KeywordsView {
  reel: string;
  planPath: string;
  keywords: KeywordView[];
  promotable: PromotableWord[];
  /** Why there are none. Null when there are some. */
  emptyReason: string | null;
  source: {
    stageStatus: string;
    cacheEntryId: string | null;
    cacheProvenance: string | null;
    promptVersion: number;
    mode: 'auto' | 'propose';
  };
  subtitleFontSize: number;
  keywordFontSize: number;
}

export interface CandidateView {
  id: string;
  imagePath: string;
  imageExists: boolean;
  cutoutPath: string | null;
  cutoutExists: boolean;
  /*
   * Optional because the panel and the service are deployed separately: a
   * reloaded bundle can be newer than the long-running service it talks to, and
   * a field it does not send must not be read as a fact about the disk.
   */
  renderedPath?: string;
  renderedExists?: boolean;
  modelId: string | null;
  resolution: string | null;
  generatedAt: string | null;
  costUsd: number | null;
  metrics: {
    alphaEdgeNoise: number;
    holeRatio: number;
    foregroundArea: number;
    edgeHalo: number;
  } | null;
  cutoutQuality: number | null;
  qualityApplies?: boolean;
  backgroundCameAwayCleanly?: boolean | null;
  problems?: string[];
  gatePassed: boolean | null;
  gateFailures: string[];
  unexpectedText: string[];
  chosen: boolean;
}

export interface ImageSlotView {
  id: string;
  start: number;
  end: number;
  idea: string;
  presentation: 'cutout' | 'card' | null;
  rendersAsCutout?: boolean;
  nothingIsMeasured?: boolean;
  templateId: string | null;
  zoneId: string | null;
  candidates: CandidateView[];
  chosenCandidateId: string | null;
  overriddenFailures: string[];
  buildsWith: string | null;
  buildsWithReason: string;
}

export interface ImagesView {
  reel: string;
  planPath: string;
  slots: ImageSlotView[];
  generationEstimateUsd: number | null;
  generationNote: string | null;
  reelSpentUsd: number | null;
  source: {
    clientMode: string | null;
    clientModeVersion: number | null;
    stageStatus: string;
    cacheEntryId: string | null;
    cacheProvenance: string | null;
  };
  cardFrameForced: boolean;
}
