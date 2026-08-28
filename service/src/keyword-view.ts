import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  KEYWORD_FONT_SIZE,
  loadSfxIndex,
  loadTemplateManifest,
  REPO_ROOT,
  SUBTITLE_FONT_SIZE,
  templatesById,
} from '@framopia/core';
import { listReels } from './catalogue.js';
import { readEditPlan, writeEditPlan } from './editplan/io.js';
import { deriveSfxDetail, deriveSfxEvents } from './analysis/sfx.js';
import { templateImpacts } from './analysis/template-impacts.js';
import { SCRIPT_VARIANT_SUFFIX } from './analysis/assign.js';
import { ACTIVE_ANALYSIS_PROMPT_VERSION } from './analysis/keywords.js';
import { scriptVariantOf } from './transcript-view.js';
import type { EditPlan, KeywordItem, SfxEvent } from './editplan/types.js';

/**
 * Step 3, the keyword picker: which words are emphasised, what template each
 * takes, and what sound fires with it.
 *
 * Everything is derived from the plan, and every edit is written back through
 * `writeEditPlan`, which validates — a keyword naming an unknown word, claiming
 * a removed one or overlapping another cannot reach disk.
 */
export class KeywordViewError extends Error {}

export interface KeywordSfxView {
  sfxId: string;
  /** Absolute path to the audio, so the panel can name it and try to play it. */
  file: string;
  fileExists: boolean;
  gainDb: number;
  /** Seconds after the card's start. */
  offsetS: number;
  /**
   * Where the file's loudest point is, measured by `npm run sfx:measure`. The
   * preview seeks here so the user hears the impact rather than the run-up —
   * `hit_01`'s peak is 2.05 s in, so playing from the start is two seconds of
   * lead before the sound he is judging.
   */
  peakOffsetS: number | null;
  /** Absolute time on the reel. */
  timeS: number;
}

export interface KeywordView {
  id: string;
  wordIds: string[];
  text: string;
  /** The card this keyword renders in place of. */
  cardId: string | null;
  start: number;
  end: number;
  /** Why the analysis chose it. Empty when a human promoted the word. */
  reason: string;
  score: number;
  kind: 'label' | 'promise' | null;
  script: 'latin' | 'arabic';
  templateId: string | null;
  fontSize: number;
  edited: boolean;
  sfx: KeywordSfxView | null;
  /**
   * Why this keyword has no sound, when it has none. A hit thinned out for
   * landing too close to the previous one is a rule doing its job, and the
   * panel must not show it the same way as a missing binding.
   */
  sfxDroppedSinceS: number | null;
}

/** A word that could be promoted: not already a keyword, not removed. */
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
  /** Why there are none, when there are none. Null when there are some. */
  emptyReason: string | null;
  /** Where the keyword data came from, per guidelines §3. */
  source: {
    stageStatus: string;
    /** The analysis cache entry the plan recorded, when it recorded one. */
    cacheEntryId: string | null;
    cacheProvenance: string | null;
    promptVersion: number;
    mode: 'auto' | 'propose';
  };
  subtitleFontSize: number;
  keywordFontSize: number;
}

function planFor(reelLabel: string): { planPath: string } {
  const reel = listReels().find((r) => r.label === reelLabel);
  if (reel === undefined) {
    throw new KeywordViewError(
      `no reel labelled "${reelLabel}" in benchmarks/footage.json`,
    );
  }
  if (reel.planPath === null || !existsSync(reel.planPath)) {
    throw new KeywordViewError(
      `${reelLabel} has no edit plan yet. Run the pipeline before picking keywords.`,
    );
  }
  return { planPath: reel.planPath };
}

/** A keyword's script is its words'; a mixed span cannot be one keyword. */
function scriptOf(plan: EditPlan, wordIds: string[]): 'latin' | 'arabic' {
  const scripts = wordIds.map(
    (id) => plan.transcript.words.find((w) => w.id === id)?.script,
  );
  return scripts.includes('arabic') ? 'arabic' : 'latin';
}

function sfxViewOf(
  plan: EditPlan,
  keyword: KeywordItem,
): KeywordSfxView | null {
  const event: SfxEvent | undefined = plan.sfx.events.find(
    (e) => e.sourceElementId === keyword.id,
  );
  if (event === undefined) return null;
  const entry = loadSfxIndex().sfx.find((s) => s.id === event.sfxId);
  const file =
    entry === undefined
      ? ''
      : path.join(REPO_ROOT, 'assets', 'sfx', entry.file);
  const measured = (entry as { measured?: { peakOffsetS?: number } } | undefined)?.measured;
  return {
    sfxId: event.sfxId,
    file,
    fileExists: file !== '' && existsSync(file),
    gainDb: event.gainDb,
    offsetS: Number((event.timeS - keyword.start).toFixed(3)),
    peakOffsetS: typeof measured?.peakOffsetS === 'number' ? measured.peakOffsetS : null,
    timeS: event.timeS,
  };
}

export async function keywordsView(reelLabel: string): Promise<KeywordsView> {
  const { planPath } = planFor(reelLabel);
  return viewOf(await readEditPlan(planPath), planPath, reelLabel);
}

export async function keywordsViewForPlan(
  planPath: string,
): Promise<KeywordsView> {
  const label =
    listReels().find((r) => r.planPath === planPath)?.label ?? planPath;
  return viewOf(await readEditPlan(planPath), planPath, label);
}

function viewOf(
  plan: EditPlan,
  planPath: string,
  reelLabel: string,
): KeywordsView {
  const cardOf = new Map<string, string>();
  for (const group of plan.subtitles.groups) {
    for (const id of group.wordIds) cardOf.set(id, group.id);
  }

  // Re-derived rather than read off the plan: the plan records the events that
  // survived, and a keyword the spacing rule thinned out leaves nothing behind
  // to distinguish it from one whose template binds no sound at all.
  const droppedSince = new Map<string, number>(
    deriveSfxDetail(
      plan,
      templatesById(loadTemplateManifest()),
      loadSfxIndex(),
      templateImpacts(),
      plan.source.dialogueLufs,
      plan.source.dialoguePeakDbfs,
    ).dropped.map((d) => [d.elementId, d.sinceS]),
  );

  const keywords: KeywordView[] = [...plan.keywords.items]
    .sort((a, b) => a.start - b.start || a.id.localeCompare(b.id))
    .map((k) => ({
      id: k.id,
      wordIds: k.wordIds,
      text: k.text,
      cardId: cardOf.get(k.wordIds[0] ?? '') ?? null,
      start: k.start,
      end: k.end,
      reason: k.reason,
      score: k.score,
      kind: k.kind ?? null,
      script: scriptOf(plan, k.wordIds),
      templateId: k.templateId,
      fontSize: KEYWORD_FONT_SIZE,
      edited: k.edited === true,
      sfx: sfxViewOf(plan, k),
      sfxDroppedSinceS: droppedSince.get(k.id) ?? null,
    }));

  const claimed = new Set(plan.keywords.items.flatMap((k) => k.wordIds));

  const promotable: PromotableWord[] = plan.transcript.words
    .filter((w) => !w.removed && !claimed.has(w.id))
    .map((w) => ({
      wordId: w.id,
      text: w.text,
      cardId: cardOf.get(w.id) ?? null,
      script: w.script,
      start: w.start,
      end: w.end,
    }));

  /*
   * A reel with no keywords must say **why**. "Analysis has not run" and
   * "analysis ran and chose none" are different facts and an empty list states
   * neither.
   */
  const status = plan.pipeline.analysis.status;
  const emptyReason =
    keywords.length > 0
      ? null
      : status === 'done'
        ? 'Keyword analysis has run for this reel and selected none.'
        : `Keyword analysis has not run for this reel yet (stage is "${status}"). ` +
          'Run the pipeline from step 1 first.';

  return {
    reel: reelLabel,
    planPath,
    keywords,
    promotable,
    emptyReason,
    source: {
      stageStatus: status,
      cacheEntryId: plan.pipeline.analysis.cacheEntryId ?? null,
      cacheProvenance: plan.pipeline.analysis.cacheProvenance ?? null,
      promptVersion: ACTIVE_ANALYSIS_PROMPT_VERSION,
      mode: plan.keywords.mode,
    },
    subtitleFontSize: SUBTITLE_FONT_SIZE,
    keywordFontSize: KEYWORD_FONT_SIZE,
  };
}

/**
 * Re-derives the SFX block after a keyword changes.
 *
 * ARCHITECTURE §3 calls SFX generated and never hand-authored, so it is
 * recomputed from the assigned templates and the manifest bindings rather than
 * patched — a hit added by hand would drift from the binding the moment the
 * manifest moved.
 */
function rederiveSfx(plan: EditPlan): void {
  plan.sfx.events = deriveSfxEvents(
    plan,
    templatesById(loadTemplateManifest()),
    loadSfxIndex(),
    templateImpacts(),
    plan.source.dialogueLufs,
    plan.source.dialoguePeakDbfs,
  );
}

/** Which cards a keyword covers, so supersession can be set and cleared. */
function cardsCovered(plan: EditPlan, wordIds: string[]): string[] {
  return plan.subtitles.groups
    .filter((g) => g.wordIds.some((id) => wordIds.includes(id)))
    .map((g) => g.id);
}

export async function removeKeyword(options: {
  planPath: string;
  keywordId: string;
}): Promise<KeywordsView> {
  const plan = await readEditPlan(options.planPath);
  const keyword = plan.keywords.items.find((k) => k.id === options.keywordId);
  if (keyword === undefined) {
    throw new KeywordViewError(
      `no keyword "${options.keywordId}" in ${options.planPath}`,
    );
  }

  // The card renders itself again, so its supersession is cleared and it keeps
  // the subtitle template it already had.
  for (const group of plan.subtitles.groups) {
    if (group.supersededBy === keyword.id) group.supersededBy = null;
  }
  plan.keywords.items = plan.keywords.items.filter((k) => k.id !== options.keywordId);
  /*
   * The durable trace of the decision. `edited` protects a keyword a human
   * added, because there is an item to flag; a removal leaves nothing, so a
   * transcript change cleared the block and the analysis put the keyword
   * straight back — the deletion undone silently.
   */
  const removed = new Set(plan.keywords.removedWordIds ?? []);
  for (const wordId of keyword.wordIds) removed.add(wordId);
  plan.keywords.removedWordIds = [...removed].sort();
  rederiveSfx(plan);
  plan.meta.updatedAt = new Date().toISOString();
  await writeEditPlan(options.planPath, plan);
  return keywordsViewForPlan(options.planPath);
}

/**
 * Promotes a transcript word to a keyword.
 *
 * `edited` is set so `mergeIntoExistingPlan` refuses to discard it on a re-run:
 * a transcript change clears the keyword block, and `PlanMergeBlockedError`
 * stops that when a human has touched an item. The choice cannot be lost
 * silently.
 */
export async function addKeyword(options: {
  planPath: string;
  wordId: string;
}): Promise<KeywordsView> {
  const plan = await readEditPlan(options.planPath);
  const word = plan.transcript.words.find((w) => w.id === options.wordId);
  if (word === undefined) {
    throw new KeywordViewError(
      `no word "${options.wordId}" in ${options.planPath}`,
    );
  }
  if (word.removed) {
    throw new KeywordViewError(
      `${options.wordId} is marked removed; restore it in the transcript before emphasising it`,
    );
  }
  if (plan.keywords.items.some((k) => k.wordIds.includes(options.wordId))) {
    throw new KeywordViewError(`${options.wordId} is already a keyword`);
  }

  // Promoting a word the user had removed is them changing their mind, so the
  // marker goes with it rather than outliving the decision it recorded.
  if (plan.keywords.removedWordIds !== undefined) {
    plan.keywords.removedWordIds = plan.keywords.removedWordIds.filter(
      (id) => id !== options.wordId,
    );
  }

  const cards = cardsCovered(plan, [options.wordId]);
  const base = templatesById(loadTemplateManifest()).has('kw_slam')
    ? 'kw_slam'
    : null;
  const templateId = base === null ? null : scriptVariantOf(base, word.script);

  const nextNumber = plan.keywords.items.length + 1;
  const id = `k${String(nextNumber).padStart(3, '0')}`;
  const unique = plan.keywords.items.some((k) => k.id === id)
    ? `k${Date.now()}`
    : id;

  plan.keywords.items.push({
    id: unique,
    wordIds: [options.wordId],
    text: word.text,
    score: 1,
    // Not a model's reason: a human chose it, and inventing one would read as
    // the analysis having said something it never said.
    reason: '',
    approved: true,
    templateId,
    start: word.start,
    end: word.end,
    edited: true,
  });
  /*
   * Appended, not sorted in. The stored order is the selector's — by score —
   * and re-sorting the block would change every item's position as a side
   * effect of adding one. The view presents them in time order instead, which
   * is a rendering decision and not a change to the plan.
   */

  for (const group of plan.subtitles.groups) {
    if (cards.includes(group.id)) group.supersededBy = unique;
  }

  rederiveSfx(plan);
  plan.meta.updatedAt = new Date().toISOString();
  await writeEditPlan(options.planPath, plan);
  return keywordsViewForPlan(options.planPath);
}

/** The `_ar` suffix is the only difference between the two keyword variants. */
export const KEYWORD_TEMPLATE_BASE = 'kw_slam';
export const KEYWORD_TEMPLATE_AR = `${KEYWORD_TEMPLATE_BASE}${SCRIPT_VARIANT_SUFFIX}`;
