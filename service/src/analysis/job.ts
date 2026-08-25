import {
  loadConfig,
  loadMode,
  loadSfxIndex,
  loadTemplateManifest,
  templatesById,
  type ClientMode,
} from '@framopia/core';
import { readEditPlan, writeEditPlan } from '../editplan/io.js';
import type { EditPlan, ImageSlot, KeywordItem } from '../editplan/types.js';
import { regroupForKeywords, type DroppedKeyword } from './regroup.js';
import { assignTemplates, type AssignmentResult } from './assign.js';
import { deriveSfxEvents } from './sfx.js';
import { analyseKeywordsCached, planSlotsCached, type CachedKeywordResult, type CachedSlotResult } from './cached.js';
import { ACTIVE_ANALYSIS_PROMPT_VERSION } from './keywords.js';
import { ACTIVE_SLOT_PROMPT_VERSION } from './slots.js';
import type { AnalysisWord, KeywordMode } from './types.js';

/** Mirrors transcriptionConfigLabel: the prompt version is the identity. */
export function analysisConfigLabel(promptVersion: number, mode: ClientMode): string {
  return `keywords-prompt-v${promptVersion}-${mode.id}-v${mode.version}`;
}

export function slotConfigLabel(promptVersion: number, mode: ClientMode): string {
  return `slots-prompt-v${promptVersion}-${mode.id}-v${mode.version}`;
}

export function planWordsForAnalysis(plan: EditPlan): AnalysisWord[] {
  return plan.transcript.words.map((w) => ({
    id: w.id,
    text: w.text,
    start: w.start,
    end: w.end,
    removed: w.removed,
  }));
}

export interface AnalyseKeywordsOptions {
  planPath: string;
  modeId: string;
  keywordMode: KeywordMode;
  bypassCache?: boolean;
  cacheRoot?: string;
  log?: (message: string) => void;
  now?: () => string;
  /** Injected in tests, so a plan can be enriched without an API key. */
  runCached?: typeof analyseKeywordsCached;
}

export interface AnalyseKeywordsResult {
  planPath: string;
  plan: EditPlan;
  analysis: CachedKeywordResult;
  cached: boolean;
  /** Keywords the re-grouping pass could not make buildable. */
  regroupDropped: DroppedKeyword[];
}

/**
 * Reads a plan, runs keyword analysis over its transcript, and writes the
 * result back. `writeEditPlan` validates first, so a keyword that does not
 * resolve, claims a removed word or overlaps another cannot reach disk.
 */
export async function analyseKeywordsForPlan(
  options: AnalyseKeywordsOptions,
): Promise<AnalyseKeywordsResult> {
  const {
    planPath,
    modeId,
    keywordMode,
    bypassCache = false,
    cacheRoot,
    log = (): void => undefined,
    now = () => new Date().toISOString(),
    runCached = analyseKeywordsCached,
  } = options;

  const plan = await readEditPlan(planPath);
  const mode = loadMode(modeId);
  const config = loadConfig();
  const words = planWordsForAnalysis(plan);

  const analysis = await runCached({
    apiKey: config.googleApiKey,
    videoSha256: plan.source.sha256,
    durationS: plan.source.durationS,
    words,
    mode,
    keywordMode,
    bypassCache,
    cacheRoot,
    log,
  });

  for (const warning of analysis.warnings) log(`warning [analysis]: ${warning}`);
  for (const failure of analysis.selection.failures) {
    log(
      `analysis: dropped candidate ${JSON.stringify(failure.candidate.wordIds)} (${failure.reason})`,
    );
  }

  // auto approves what it selected; propose leaves the checkboxes for the
  // panel. The selection itself is identical either way — the mode is a run
  // parameter and never reaches the model.
  const approved = keywordMode === 'auto';
  const proposed: KeywordItem[] = analysis.selection.items.map((item, i) => ({
    id: `k${String(i + 1).padStart(3, '0')}`,
    wordIds: item.wordIds,
    text: item.text,
    score: item.score,
    reason: item.reason,
    approved,
    templateId: null,
    start: item.start,
    end: item.end,
  }));

  // Groups were derived during transcription, before any keyword existed, so
  // a span can straddle two of them. A keyword replaces its group's
  // rendering, which is only expressible when the two are the same thing.
  const regrouped = regroupForKeywords({
    groups: plan.subtitles.groups,
    words: plan.transcript.words,
    keywords: proposed,
  });
  for (const drop of regrouped.dropped) {
    log(`analysis: dropped keyword ${drop.keywordId} (${drop.reason})`);
  }
  const kept = new Set(regrouped.keptKeywordIds);
  const items = proposed.filter((item) => kept.has(item.id));

  const timestamp = now();
  plan.subtitles.groups = regrouped.groups;
  plan.keywords = { mode: keywordMode, items };
  plan.pipeline.analysis = {
    status: 'done',
    config: analysisConfigLabel(ACTIVE_ANALYSIS_PROMPT_VERSION, mode),
    costUsd: analysis.cached ? 0 : analysis.costUsd,
    cached: analysis.cached,
    completedAt: timestamp,
    error: null,
  };
  // Zero on a hit rather than absent, for the reason transcription records
  // its own zero: a byStage key that appears and vanishes between runs reads
  // as a pipeline change.
  const stageCost = analysis.cached ? 0 : analysis.costUsd;
  plan.costs.byStage.analysis = stageCost;
  plan.costs.totalUsd = Object.values(plan.costs.byStage).reduce((n, v) => n + v, 0);
  plan.meta.updatedAt = timestamp;

  await writeEditPlan(planPath, plan);

  return { planPath, plan, analysis, cached: analysis.cached, regroupDropped: regrouped.dropped };
}

export interface PlanImageSlotsOptions {
  planPath: string;
  modeId: string;
  bypassCache?: boolean;
  cacheRoot?: string;
  log?: (message: string) => void;
  now?: () => string;
  /** Injected in tests, so a plan can be enriched without an API key. */
  runCached?: typeof planSlotsCached;
}

export interface PlanImageSlotsResult {
  planPath: string;
  plan: EditPlan;
  analysis: CachedSlotResult;
  cached: boolean;
  assignment: AssignmentResult;
}

/**
 * Reads a plan, plans its image slots, and writes the result back.
 * **No image is generated here** — that is Block 4. This stage decides which
 * moments get one, what it should show, and the exact prompt that will be
 * sent when the time comes.
 */
export async function planImageSlotsForPlan(
  options: PlanImageSlotsOptions,
): Promise<PlanImageSlotsResult> {
  const {
    planPath,
    modeId,
    bypassCache = false,
    cacheRoot,
    log = (): void => undefined,
    now = () => new Date().toISOString(),
    runCached = planSlotsCached,
  } = options;

  const plan = await readEditPlan(planPath);
  const mode = loadMode(modeId);
  const config = loadConfig();
  const words = planWordsForAnalysis(plan);

  const analysis = await runCached({
    apiKey: config.googleApiKey,
    videoSha256: plan.source.sha256,
    durationS: plan.source.durationS,
    planId: plan.meta.id,
    words,
    mode,
    bypassCache,
    cacheRoot,
    log,
  });

  for (const warning of analysis.warnings) log(`warning [slots]: ${warning}`);
  for (const failure of analysis.selection.failures) {
    log(`slots: dropped candidate ${JSON.stringify(failure.candidate.wordIds)} (${failure.reason})`);
  }

  const slots: ImageSlot[] = analysis.selection.slots.map((slot, i) => ({
    id: `img${String(i + 1).padStart(3, '0')}`,
    wordIds: slot.wordIds,
    start: slot.start,
    end: slot.end,
    contextText: slot.contextText,
    idea: slot.idea,
    prompt: slot.prompt,
    negativePrompt: slot.negativePrompt,
    candidates: [],
    chosenCandidateId: null,
    presentation: null,
    zoneId: null,
    templateId: null,
    status: 'pending',
  }));

  const timestamp = now();
  plan.images = { slots };

  // Templates and sfx are re-derived on every run over the whole plan, not
  // just the slots this call produced: assignment depends on element order
  // and sfx depends on assignment, so a partial update would leave the two
  // describing different plans.
  const manifest = loadTemplateManifest();
  const templates = templatesById(manifest);
  const assignment = assignTemplates(plan, mode, templates);
  for (const issue of assignment.issues) log(`templates: ${issue.path}: ${issue.message}`);
  plan.sfx = { events: deriveSfxEvents(plan, templates, loadSfxIndex()) };
  plan.pipeline.images = {
    status: 'done',
    config: slotConfigLabel(ACTIVE_SLOT_PROMPT_VERSION, mode),
    costUsd: analysis.cached ? 0 : analysis.costUsd,
    cached: analysis.cached,
    completedAt: timestamp,
    error: null,
  };
  const stageCost = analysis.cached ? 0 : analysis.costUsd;
  plan.costs.byStage.images = stageCost;
  plan.costs.totalUsd = Object.values(plan.costs.byStage).reduce((n, v) => n + v, 0);
  plan.meta.updatedAt = timestamp;

  await writeEditPlan(planPath, plan);

  return { planPath, plan, analysis, cached: analysis.cached, assignment };
}
