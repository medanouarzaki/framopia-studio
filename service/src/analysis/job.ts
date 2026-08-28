import {
  loadConfig,
  loadMode,
  loadSfxIndex,
  loadTemplateManifest,
  templatesById,
  type ClientMode,
} from '@framopia/core';
import { recordStageSpend } from '../editplan/costs.js';
import { readEditPlan, writeEditPlan } from '../editplan/io.js';
import type { EditPlan, ImageSlot, KeywordItem } from '../editplan/types.js';
import { regroupForKeywords, type DroppedKeyword } from './regroup.js';
import { assignTemplates, type AssignmentResult } from './assign.js';
import { applyDisplayTiming, type DisplayTimingResult } from './display-timing.js';
import { deriveSfxEvents } from './sfx.js';
import { analyseKeywordsCached, planSlotsCached, type CachedKeywordResult, type CachedSlotResult } from './cached.js';
import { ACTIVE_ANALYSIS_PROMPT_VERSION, parseKeywordResponse } from './keywords.js';
import { selectTermSpans } from './terms.js';
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
    ...(item.kind === undefined ? {} : { kind: item.kind }),
  }));

  // Terms come out of the same response as the candidates, read back from the
  // raw text so a cache hit and a live call go down one path — a hit replays
  // the response byte for byte, so there is nothing extra to store.
  const parsedTerms = parseKeywordResponse(analysis.rawText).terms;
  if (parsedTerms !== undefined) {
    const selected = selectTermSpans({ words: plan.transcript.words, terms: parsedTerms });
    for (const drop of selected.rejected) {
      log(`analysis: dropped term ${JSON.stringify(drop.wordIds)} (${drop.reason})`);
    }
    if (selected.uncoveredWordIds.length > 0) {
      log(
        `analysis: ${selected.uncoveredWordIds.length} Arabic-script word(s) in no term: ` +
          selected.uncoveredWordIds.join(', '),
      );
    }
    plan.transcript.terms = selected.terms;
  }

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
  /*
   * A word the user took off the keyword list stays off it. Without this the
   * analysis re-proposed it on the next run and the deletion was undone
   * silently — ARCHITECTURE §3 says an automated re-run never overwrites a
   * human-flagged item, and a removal is one.
   */
  const removedByHand = new Set(plan.keywords.removedWordIds ?? []);
  const items = proposed.filter(
    (item) => kept.has(item.id) && !item.wordIds.some((id) => removedByHand.has(id)),
  );
  for (const item of proposed) {
    if (item.wordIds.some((id) => removedByHand.has(id))) {
      log(`analysis: "${item.text}" was removed by hand and is not proposed again`);
    }
  }

  const timestamp = now();
  plan.subtitles.groups = regrouped.groups;
  plan.keywords = {
    mode: keywordMode,
    items,
    ...(plan.keywords.removedWordIds === undefined
      ? {}
      : { removedWordIds: plan.keywords.removedWordIds }),
  };

  /*
   * Assignment used to live only in the slot stage, so this stage wrote every
   * keyword with `templateId: null` and any keyword run after a slot run left
   * them that way — which is why no keyword on any plan carried an id, and why
   * SFX derivation had nothing to attach a hit to. A stage that creates
   * elements assigns their templates before it writes them.
   *
   * It is deterministic and free (Block 3 decision 10's seeded shuffle over the
   * mode's allowed variants), so running it in both stages costs nothing and
   * the two agree by construction. Re-grouping just above can split a group,
   * so subtitles need re-assigning here anyway.
   */
  const templates = templatesById(loadTemplateManifest());
  const assignment = assignTemplates(plan, mode, templates);
  for (const issue of assignment.issues) log(`templates: ${issue.path}: ${issue.message}`);
  plan.sfx = { events: deriveSfxEvents(plan, templates, loadSfxIndex()) };

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
  recordStageSpend(plan, 'analysis', stageCost);
  plan.meta.updatedAt = timestamp;

  await writeEditPlan(planPath, plan);

  return { planPath, plan, analysis, cached: analysis.cached, regroupDropped: regrouped.dropped };
}

export interface PlanImageSlotsOptions {
  planPath: string;
  modeId: string;
  bypassCache?: boolean;
  cacheRoot?: string;
  /** Discard recomposed prompts and generated candidates. Never the default. */
  force?: boolean;
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
  timing: DisplayTimingResult;
}

/**
 * A re-run would replace `plan.images` wholesale, which is correct for a
 * freshly planned reel and destructive for one that has been recomposed or
 * generated against. Mirrors `PlanMergeBlockedError`: it names what would be
 * lost and demands an explicit --force rather than deciding for the operator.
 */
export class SlotsReplaceBlockedError extends Error {
  constructor(readonly reasons: { slotId: string; detail: string }[]) {
    super(
      `re-planning would discard work on ${reasons.length} slot(s): ` +
        `${reasons.map((r) => `${r.slotId} (${r.detail})`).join('; ')}. ` +
        'The ideas would be re-requested from the model and would come back different, ' +
        'because the call is not reproducible. Re-run with --force to discard them.',
    );
    this.name = 'SlotsReplaceBlockedError';
  }
}

/**
 * What a wholesale replacement of `plan.images.slots` would destroy. A
 * recomposed prompt counts: it is the product of a deliberate mode edit that
 * no re-run reproduces, since a re-run asks the model for fresh ideas.
 */
export function slotsReplacementFlags(plan: EditPlan): { slotId: string; detail: string }[] {
  const reasons: { slotId: string; detail: string }[] = [];
  for (const slot of plan.images.slots) {
    if (slot.promptModeVersion !== undefined) {
      reasons.push({
        slotId: slot.id,
        detail: `prompt recomposed at mode v${slot.promptModeVersion}`,
      });
    }
    if (slot.candidates.length > 0) {
      reasons.push({ slotId: slot.id, detail: `${slot.candidates.length} generated candidate(s)` });
    }
    if (slot.chosenCandidateId !== null) {
      reasons.push({ slotId: slot.id, detail: `a candidate was chosen (${slot.chosenCandidateId})` });
    }
  }
  return reasons;
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
    force = false,
    log = (): void => undefined,
    now = () => new Date().toISOString(),
    runCached = planSlotsCached,
  } = options;

  const plan = await readEditPlan(planPath);
  // Before the model is asked for anything: a blocked re-run must cost
  // nothing, the way the ceiling gate works for images.
  const blocked = slotsReplacementFlags(plan);
  if (blocked.length > 0 && !force) throw new SlotsReplaceBlockedError(blocked);
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
  assignTemplates(plan, mode, templates);

  // Display timing needs the assigned template's floor, and a merge produces a
  // card that has never been assigned one — so assignment runs again over the
  // final group list. It is deterministic, so the second pass is free of
  // surprises.
  const timing = applyDisplayTiming({
    groups: plan.subtitles.groups,
    templates,
    reelDurationS: plan.source.durationS,
  });
  plan.subtitles.groups = timing.groups;
  for (const merge of timing.merged) {
    log(`subtitles: merged ${merge.from.join(' + ')} to reach the template floor`);
  }
  for (const u of timing.unbuildable) {
    log(
      `subtitles: ${u.groupId} "${u.wordIds.join(' ')}" has ${u.haveS.toFixed(2)}s of ${u.needS.toFixed(2)}s and cannot be fixed (${u.reason})`,
    );
  }

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
  recordStageSpend(plan, 'imageSlots', stageCost);
  plan.meta.updatedAt = timestamp;

  await writeEditPlan(planPath, plan);

  return { planPath, plan, analysis, cached: analysis.cached, assignment, timing };
}
