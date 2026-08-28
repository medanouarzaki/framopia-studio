export const EDIT_PLAN_SCHEMA_VERSION = 1;

export type StageStatus = 'pending' | 'running' | 'done' | 'error';

export interface PipelineStage {
  status: StageStatus;
  config: string | null;
  costUsd: number | null;
  cached: boolean | null;
  completedAt: string | null;
  error: string | null;
  /**
   * Which cache entry produced this stage, and how it was found. Schema
   * addition, **optional with a default**: a plan written before Block 8
   * session 14 carries neither and opens unchanged.
   *
   * `cached: true` says money was not spent; it does not say *what was
   * reused*. A `compatible` reuse is a transcription made against an older
   * orthography guide, and a plan that does not record which entry it came
   * from cannot be told apart from one made against the current rules.
   * Guidelines §3: a tool names the inputs it selected, in its artifact.
   */
  cacheEntryId?: string | null;
  cacheProvenance?: 'exact' | 'compatible' | 'none' | null;
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
  /**
   * Which contiguous runs of Arabic-script words form one ORTHOGRAPHY_GUIDE §6
   * domain term. Departure from ARCHITECTURE §3, which has no place for it.
   *
   * §6c forbids breaking a term across subtitle cards, and the boundaries are
   * not derivable from the words: script and lang are uniform across a run,
   * and test-2 carries an eight-word run that is three adjacent terms with no
   * Latin word between them. Timing does not separate them either — one true
   * boundary sits at the run's largest internal gap and the other at 0.060 s,
   * indistinguishable from gaps inside a term.
   *
   * **Optional with a default, per the standing schema rule.** Absent means
   * the analysis pass has not run, which is NOT the same as "every run is one
   * term": grouping falls back to its script-agnostic behaviour rather than
   * guessing boundaries.
   */
  terms?: TermSpan[];
}

/** One §6 domain term, as the word ids it spans, in transcript order. */
export interface TermSpan {
  wordIds: string[];
}

export interface SubtitleGroup {
  id: string;
  wordIds: string[];
  /** Derived from the words, and re-derivable after a transcript edit. */
  start: number;
  end: number;
  templateId: string | null;
  /**
   * The keyword that renders in this group's place. Departure from
   * ARCHITECTURE §3, which gives a group no such field: a keyword span and a
   * subtitle group can claim the same words, and §3 never says which wins.
   * The rule is that the keyword replaces the group's rendering, and the
   * builder must be told rather than left to work it out from overlapping
   * time ranges. Null on every group no keyword claims.
   */
  supersededBy?: string | null;
  /**
   * True once a human adjusted this group in the panel, mirroring
   * `PlanWord.edited`. ARCHITECTURE §3 requires that an automated re-run never
   * overwrite a flagged item, and the keyword-aware re-grouping pass is
   * exactly such a re-run; groups had no way to carry the flag.
   */
  edited?: boolean;
  /**
   * How long the card is on screen, which is not the same question as when the
   * words were spoken. `start`/`end` remain the word timings and §3's single
   * timing authority; these extend forward so a short word's animation can
   * play, never into the next group and never past the reel.
   *
   * Departure from ARCHITECTURE §3, which gives a group only start/end.
   * **Optional with a default** — absent means the display window is the
   * speech window — so a plan written before this field stays readable.
   */
  displayStart?: number;
  displayEnd?: number;
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
  /**
   * Whether this keyword names the thing (`label`) or states what it does for
   * the viewer (`promise`). Departure from ARCHITECTURE §3, which does not
   * name the field; the selector forces a mix of both, and the panel needs to
   * show which is which. **Optional with a default** — absent means a prompt
   * version that never asked.
   */
  kind?: 'label' | 'promise';
}

export interface Keywords {
  mode: 'auto' | 'propose';
  items: KeywordItem[];
  /**
   * Word ids a human took off the keyword list.
   *
   * `edited` protects a keyword a human *added*, because there is an item to
   * flag. A removal leaves nothing behind, so a transcript change cleared the
   * block and the analysis put the keyword straight back — the user's deletion
   * undone silently, which is the one thing ARCHITECTURE §3's rule exists to
   * prevent. This is the durable trace of that decision.
   *
   * **Schema addition, optional with a default**: absent means no keyword has
   * been removed by hand, which every plan written before Block 8 session 21
   * is true of. Validated only when present.
   */
  removedWordIds?: string[];
}

/**
 * ARCHITECTURE §5.4's cutout gate metrics. Null until the gate runs; a
 * candidate generated before the gate existed simply has no metrics, which is
 * different from having failed it.
 */
export interface CutoutMetrics {
  alphaEdgeNoise: number;
  holeRatio: number;
  foregroundArea: number;
  edgeHalo: number;
}

/** One OCR detection: what was read and how confident the reader was. */
export interface DetectedText {
  text: string;
  /** 0-1 as reported by the reader. */
  confidence: number;
}

/**
 * The correctness verdict on a candidate's text. Text is permitted since the
 * Block 4 session 5 ruling; **uncontrolled** text is the failure, and Block 2
 * recorded one brand name emerging three ways across three identical calls.
 */
export interface TextVerdict {
  /** True when anything with meaning was read; stopwords alone do not count. */
  hasText: boolean;
  /** Words the slot is entitled to show, normalised. */
  expected: string[];
  /** Words it is not. Non-empty is the advisory warning. */
  unexpected: string[];
  ok: boolean;
}

/** The §5.4 quality gate's outcome for one candidate. */
export interface CandidateGate {
  presentation: 'cutout' | 'card';
  passed: boolean;
  /** Every metric that failed, each naming its value and its bound. */
  failures: string[];
}

export interface ImageCandidate {
  id: string;
  path: string;
  cutoutPath: string | null;
  cutoutQuality: number | null;
  /**
   * Everything below is a Block 4 addition and every one of them is optional.
   * `readEditPlan` validates on read, so a required field here would make
   * every plan written before Block 4 unopenable — including for a migration
   * that wanted to add the field. Block 3 session 5 hit exactly that and had
   * to back a check out of structural validation.
   *
   * Which model produced this candidate. Absent on a plan predating Block 4,
   * and the two candidate models differ enough that guessing one would be a
   * fabricated provenance record.
   */
  modelId?: string;
  /** Generation tier, `1K` or `2K`. 4K is rejected by config validation. */
  resolution?: string;
  /** ISO 8601, set when the bytes were written. */
  generatedAt?: string;
  /** What the image actually cost, from the per-image rate in core. */
  costUsd?: number;
  /** The cache fingerprint the bytes live under, so a plan can find them. */
  promptFingerprint?: string;
  /** §5.4 metrics. Null once the gate has run and produced nothing usable. */
  metrics?: CutoutMetrics | null;
  /**
   * Text the OCR pass found in the generated image. **Advisory, never a
   * delete**: it surfaces to the editor and nothing acts on it
   * automatically, because a false positive on a texture that reads like
   * lettering must not silently drop a good candidate.
   *
   * A negative prompt is not a control. One of the six Block 4 images
   * rendered a legible English product label despite `no text, no watermark,
   * no logo`, on a reel that is Darija for a Moroccan clinic. Optional with a
   * default, like every Block 4 addition: absent means the pass has not run,
   * which is different from having run and found nothing.
   */
  detectedText?: DetectedText[] | null;
  /**
   * Whether the detected text is text this slot is entitled to show, checked
   * against the slot's own `idea` plus the client mode's vocabulary.
   *
   * A sibling field rather than a shape change to `detectedText`: that is an
   * array on plans already written, and the schema fragility rule makes every
   * addition optional. Absent means the check has not run; `ok` with empty
   * lists means it ran and found nothing to object to.
   *
   * **Advisory.** `ok: false` names words and nothing more — it does not
   * delete, reject or re-roll, because a false positive on a stylised texture
   * must not silently drop a good candidate.
   */
  textVerdict?: TextVerdict | null;
  /**
   * The §5.4 gate's verdict on this candidate's matte, and why it failed if
   * it did. Optional: absent means the gate has not run, which is not the
   * same as having run and passed.
   *
   * Per candidate, because the gate judges a matte and each candidate has its
   * own. The slot's `presentation` is a separate question — it follows
   * whichever candidate the editor picks.
   */
  gate?: CandidateGate | null;
}

export interface ImageSlot {
  id: string;
  /**
   * The transcript span this slot illustrates. Departure from ARCHITECTURE
   * §3, which gives a slot only start/end: without the ids there is no way to
   * tell after a re-transcription whether the span still exists, and the
   * merge would have to guess from timings.
   */
  wordIds: string[];
  start: number;
  end: number;
  contextText: string;
  idea: string;
  prompt: string;
  negativePrompt: string;
  candidates: ImageCandidate[];
  chosenCandidateId: string | null;
  /**
   * The `version` of the mode whose fragments composed `prompt` and
   * `negativePrompt`. Optional under the schema fragility rule: a required
   * field here would make every plan written before Block 4 session 3
   * unopenable, migration included. Absent means "composed by the analysis
   * run that created the slot, mode version unrecorded".
   *
   * It exists so a re-run can tell a recomposed slot from a freshly planned
   * one without diffing prompt strings.
   */
  promptModeVersion?: number;
  /**
   * Quality-gate outcome, editor-overridable. **Null until the gate runs**,
   * which is Block 4 — §3 types it as always set, but the planner has no
   * image to judge and a guessed `cutout` would read as a decision.
   */
  presentation: 'cutout' | 'card' | null;
  zoneId: string | null;
  /**
   * Where the solver put the image and how big, TEMPLATE_LIBRARY_GUIDE §6:
   * position and uniform scale, nothing else. Top-left of the placed square,
   * normalized against the frame; `scale` multiplies the 1200x1200 comp.
   *
   * **Schema addition, optional with a default.** Absent on every plan written
   * before Block 5 session 4, and absent means the solver has not run — which
   * is not the same as a placement at the origin.
   */
  position?: { x: number; y: number } | null;
  scale?: number | null;
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
  /**
   * `torso` is a widening of ARCHITECTURE §3's `top|left|right`, added in
   * Block 5 session 6: an image may be placed over the speaker's
   * middle-to-lower torso, never over the head or face. A widening cannot be
   * optional-with-default the way a new field can, so every existing plan was
   * reopened to prove nothing was made unreadable.
   */
  kind: 'top' | 'left' | 'right' | 'torso';
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
  /**
   * The audio layer's in-point, derived so the file's anchor lands on the
   * template's impact frame. It used to be the element's start plus a fixed
   * offset, which assumed the impact was at the file's first sample.
   */
  timeS: number;
  gainDb: number;
  /**
   * Where the anchor actually lands. **Optional with a default**: absent on any
   * plan written before Block 8 session 22, and on an event placed by the old
   * rule because its file or its template is unmeasured.
   */
  anchorAtS?: number;
  /**
   * True when the layer had to start at the composition's start because the
   * derived in-point was before it, so the anchor lands late by `clampedByS`.
   */
  clamped?: boolean;
  clampedByS?: number;
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
  /**
   * What the **most recent** run of each stage cost. A cached run writes 0
   * rather than dropping the key, so `byStage` stays diffable across runs — a
   * key that appears and vanishes reads as a pipeline change.
   *
   * This is not what the reel cost. See `spentUsd`.
   */
  totalUsd: number;
  byStage: Record<string, number>;
  /**
   * **Cumulative money actually spent on this reel**, accumulated across every
   * run. A cached run adds nothing; a regenerated slot **adds**, it does not
   * replace — so this can exceed what one clean run would cost, because the
   * money really was spent.
   *
   * Named `spent` rather than `cost` deliberately: Block 8's panel shows a
   * running total against a $2.00 soft alarm, and an alarm reading a number
   * that resets on re-run is not an alarm. `byStage` read 0 for images
   * immediately after a $1.55 run, which is what prompted this.
   *
   * Optional with a default under the schema fragility rule: absent on every
   * plan written before Block 4 session 7, and absent means unknown rather
   * than zero.
   */
  spentUsd?: number;
  spentByStage?: Record<string, number>;
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
