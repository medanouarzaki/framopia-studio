import { existsSync } from 'node:fs';
import { loadTemplateManifest, templatesById } from '@framopia/core';
import { listReels } from './catalogue.js';
import { readEditPlan, writeEditPlan } from './editplan/io.js';
import { checkBuildability } from './analysis/buildability.js';
import { SCRIPT_VARIANT_SUFFIX } from './analysis/assign.js';
import { hashTranscript } from './analysis/fingerprint.js';
import type { EditPlan, PlanWord } from './editplan/types.js';

/**
 * The transcript as step 2 shows it: the words, the cards they become, and the
 * three questions the user has to rule on.
 *
 * Everything is derived here rather than in the panel. The panel is a view over
 * the plan, and a figure computed on the client is a second implementation of a
 * rule the service already owns.
 */
export class TranscriptViewError extends Error {}

export interface TranscriptWordView {
  id: string;
  text: string;
  /** The draft token this word took its timing from. Null when interpolated. */
  sourceText: string | null;
  start: number;
  end: number;
  script: 'latin' | 'arabic';
  lang: string | null;
  confidence: number | null;
  removed: boolean;
  removedReason: string | null;
  edited: boolean;
  /** The card this word renders in. */
  cardId: string | null;
  /** No draft anchor: its timing was interpolated between its neighbours. */
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
  /** A keyword renders in this card's place. */
  supersededBy: string | null;
  /** The hold is shorter than the template's floor. */
  holdClipped: boolean;
  shortByS: number | null;
}

/** One thing to look at, with the evidence for it rather than a description. */
export interface QuestionInstance {
  /** Words to show, in reading order. */
  wordIds: string[];
  /** The thing itself: the word, or the term whole. */
  text: string;
  /** The measurement that put it here, in the units the user reads. */
  detail: string;
  /** For a split term: the cards it is broken into, in order. */
  parts?: { cardId: string; text: string }[];
}

export interface OpenQuestion {
  id: 'overlong' | 'clipped' | 'split-term';
  label: string;
  /** What the user is being asked to rule on. */
  question: string;
  /** How the figure was arrived at, including anything it cannot see. */
  basis: string;
  /** Word ids to look at, in reading order. */
  wordIds: string[];
  /**
   * **This reel.** The counts on screen read 1, 5 and 0 for `vitasilk` while
   * the report said 7, 23 and 13 — both right, one per reel and one over the
   * corpus, and nothing said which. A count with no scope is what put the wrong
   * number in front of the user.
   */
  count: number;
  /** The same question across every reel that has a plan. */
  corpusCount: number;
  /** True when the figure stands in for a measurement it cannot take. */
  proxy: boolean;
  /** The instances, with what makes each one an instance. */
  instances: QuestionInstance[];
}

export interface TranscriptView {
  reel: string;
  planPath: string;
  words: TranscriptWordView[];
  cards: TranscriptCardView[];
  questions: OpenQuestion[];
  /** What an edit would invalidate, so the panel can say it before he types. */
  editCost: string;
  transcriptHash: string;
}

/**
 * A single word wide enough that it will not fit its card.
 *
 * **This is a proxy.** The real measurement is `sourceRectAtTime` inside After
 * Effects against `SUBTITLE_SAFE_WIDTH`, which is where the corpus figure of
 * seven came from; the panel cannot run After Effects, so it counts characters
 * instead. On the current corpus the two agree exactly — the seven longest
 * words are the seven that were measured overlong, and the boundary sits
 * between 11 characters and 10. A different face or a different reel could
 * separate them, so the marker says which measurement it is.
 */
export const OVERLONG_WORD_CHARS = 11;

function planFor(reelLabel: string): { plan: Promise<EditPlan>; planPath: string } {
  const reel = listReels().find((r) => r.label === reelLabel);
  if (reel === undefined) {
    throw new TranscriptViewError(`no reel labelled "${reelLabel}" in benchmarks/footage.json`);
  }
  if (reel.planPath === null || !existsSync(reel.planPath)) {
    throw new TranscriptViewError(
      `${reelLabel} has no edit plan yet. Run the pipeline before editing its transcript.`,
    );
  }
  return { plan: readEditPlan(reel.planPath), planPath: reel.planPath };
}

/**
 * Consecutive Arabic-script words that ORTHOGRAPHY_GUIDE §6 keeps whole and
 * grouping has put in more than one card.
 *
 * Returns the runs, not a flat word list: the user is ruling on how many terms
 * are broken, and counting the words inside them gives 40 where the recorded
 * corpus figure is 13.
 */
function splitArabicRuns(plan: EditPlan, cardOf: Map<string, string>): string[][] {
  const out: string[][] = [];
  let run: PlanWord[] = [];
  const flush = (): void => {
    if (run.length >= 2 && new Set(run.map((w) => cardOf.get(w.id))).size > 1) {
      out.push(run.map((w) => w.id));
    }
    run = [];
  };
  for (const word of plan.transcript.words) {
    if (word.removed) continue;
    if (word.script === 'arabic') run.push(word);
    else flush();
  }
  flush();
  return out;
}

export async function transcriptView(reelLabel: string): Promise<TranscriptView> {
  const { plan, planPath } = planFor(reelLabel);
  return viewOf(await plan, planPath, reelLabel, await corpusCounts());
}

/**
 * The view for a plan by path, without going through the catalogue.
 *
 * An edit knows its own plan path and nothing else, and looking the reel back
 * up by path made an edit fail on any plan the catalogue does not list — which
 * is every scratch copy a test can make. A writer that only works on the
 * shipped corpus is a writer that is never exercised.
 */
export async function transcriptViewForPlan(planPath: string): Promise<TranscriptView> {
  const label = listReels().find((r) => r.planPath === planPath)?.label ?? planPath;
  return viewOf(await readEditPlan(planPath), planPath, label, await corpusCounts());
}

export interface CorpusCounts {
  overlong: number;
  clipped: number;
  splitTerm: number;
}

/**
 * The same three questions across every reel that has a plan.
 *
 * Both scopes are shown because only one of them was, and nothing said which:
 * `vitasilk` read 1, 5 and 0 on screen while the record said 7, 23 and 13, and
 * both were right. A count that does not name its scope is how the wrong number
 * reaches a user who is being asked to rule on it.
 */
export async function corpusCounts(): Promise<CorpusCounts> {
  const totals: CorpusCounts = { overlong: 0, clipped: 0, splitTerm: 0 };
  for (const reel of listReels()) {
    if (reel.planPath === null || !existsSync(reel.planPath)) continue;
    let plan: EditPlan;
    try {
      plan = await readEditPlan(reel.planPath);
    } catch {
      continue;
    }
    const counts = questionCountsOf(plan);
    totals.overlong += counts.overlong;
    totals.clipped += counts.clipped;
    totals.splitTerm += counts.splitTerm;
  }
  return totals;
}

/** The three counts for one plan, without building a whole view. */
export function questionCountsOf(plan: EditPlan): CorpusCounts {
  const cardOf = new Map<string, string>();
  for (const group of plan.subtitles.groups) {
    for (const id of group.wordIds) cardOf.set(id, group.id);
  }
  const report = checkBuildability(plan, templatesById(loadTemplateManifest()));
  return {
    overlong: plan.transcript.words.filter(
      (w) => !w.removed && [...w.text.replace(/[.,?!؟،]$/u, '')].length >= OVERLONG_WORD_CHARS,
    ).length,
    clipped: report.issues.filter((i) => i.shortByS !== undefined).length,
    splitTerm: splitArabicRuns(plan, cardOf).length,
  };
}

function viewOf(
  plan: EditPlan,
  planPath: string,
  reelLabel: string,
  corpus: CorpusCounts,
): TranscriptView {

  const cardOf = new Map<string, string>();
  for (const group of plan.subtitles.groups) {
    for (const id of group.wordIds) cardOf.set(id, group.id);
  }

  const report = checkBuildability(plan, templatesById(loadTemplateManifest()));
  const shortBy = new Map<string, number>();
  /** The Build pane's own sentence, so the two screens read the same. */
  const shortfallOf = new Map<string, string>();
  for (const issue of report.issues) {
    const match = /^subtitles\.groups\[(\d+)\]/.exec(issue.path);
    if (match === null || issue.shortByS === undefined) continue;
    const group = plan.subtitles.groups[Number(match[1])];
    if (group === undefined) continue;
    shortBy.set(group.id, issue.shortByS);
    shortfallOf.set(group.id, `${issue.message} (short by ${issue.shortByS.toFixed(2)}s)`);
  }

  const words: TranscriptWordView[] = plan.transcript.words.map((w) => ({
    id: w.id,
    text: w.text,
    sourceText: w.sourceText === w.text ? null : w.sourceText,
    start: w.start,
    end: w.end,
    script: w.script,
    lang: w.lang,
    confidence: w.confidence,
    removed: w.removed,
    removedReason: w.removedReason,
    edited: w.edited === true,
    cardId: cardOf.get(w.id) ?? null,
    // No Scribe anchor: the aligner spread this word's timing between the
    // anchors on either side. `26` on vitasilk is one.
    interpolated: w.confidence === null,
  }));

  const cards: TranscriptCardView[] = plan.subtitles.groups.map((g) => ({
    id: g.id,
    wordIds: g.wordIds,
    start: g.start,
    end: g.end,
    displayStart: g.displayStart ?? null,
    displayEnd: g.displayEnd ?? null,
    templateId: g.templateId,
    supersededBy: g.supersededBy ?? null,
    holdClipped: shortBy.has(g.id),
    shortByS: shortBy.get(g.id) ?? null,
  }));

  const overlong = words.filter(
    (w) => !w.removed && [...w.text.replace(/[.,?!؟،]$/u, '')].length >= OVERLONG_WORD_CHARS,
  );
  const clippedCards = cards.filter((c) => c.holdClipped);
  const splitTerms = splitArabicRuns(plan, cardOf);

  const textOf = (ids: string[]): string =>
    ids.map((id) => words.find((w) => w.id === id)?.text ?? id).join(' ');

  const questions: OpenQuestion[] = [
    {
      id: 'overlong',
      label: 'Words too long for their card',
      question:
        'These render wider than the subtitle safe width, so they are emitted whole and clipped. ' +
        'Shrink them, break them mid-word, or let them overflow?',
      basis:
        `A proxy. The measurement is sourceRectAtTime in After Effects against the subtitle safe ` +
        `width; the panel cannot run After Effects, so it counts characters at ` +
        `${OVERLONG_WORD_CHARS} or more. The two agree exactly on this corpus.`,
      proxy: true,
      wordIds: overlong.map((w) => w.id),
      count: overlong.length,
      corpusCount: corpus.overlong,
      instances: overlong.map((w) => ({
        wordIds: [w.id],
        text: w.text,
        detail:
          `${[...w.text.replace(/[.,?!؟،]$/u, '')].length} characters against a ` +
          `${OVERLONG_WORD_CHARS}-character threshold, in card ${w.cardId ?? 'none'}. ` +
          'Today it is emitted whole and clipped at the safe width.',
      })),
    },
    {
      id: 'clipped',
      label: 'Cards whose hold is clipped',
      question:
        'The word is spoken too briefly to hold the card for its template floor, so the entrance ' +
        'is compressed to two frames and the hold is cut. Accept, lengthen, or merge?',
      basis: "From the plan's own timings against the template manifest; the builder's own rule.",
      proxy: false,
      wordIds: clippedCards.flatMap((c) => c.wordIds),
      count: clippedCards.length,
      corpusCount: corpus.clipped,
      instances: clippedCards.map((c) => ({
        wordIds: c.wordIds,
        text: textOf(c.wordIds),
        detail: shortfallOf.get(c.id) ?? `${c.id}: short by ${(c.shortByS ?? 0).toFixed(2)}s`,
      })),
    },
    {
      id: 'split-term',
      label: 'Arabic terms split across cards',
      question:
        'ORTHOGRAPHY_GUIDE §6c says a term is never broken in the subtitle track, and one word ' +
        'per card breaks these. Group them whole, or accept the break?',
      basis:
        'Consecutive Arabic-script words landing in more than one card. The guide defines a term ' +
        'semantically and the plan carries no term ids, so this is every multi-word Arabic run, ' +
        'which may be wider than the guide means. A reel whose words are all Arabizi has none by ' +
        'construction — the Arabic is in the draft, not in what gets built.',
      proxy: false,
      wordIds: splitTerms.flat(),
      count: splitTerms.length,
      corpusCount: corpus.splitTerm,
      instances: splitTerms.map((ids) => ({
        wordIds: ids,
        text: textOf(ids),
        detail: `broken across ${new Set(ids.map((id) => cardOf.get(id))).size} cards`,
        parts: ids.map((id) => ({
          cardId: cardOf.get(id) ?? 'none',
          text: words.find((w) => w.id === id)?.text ?? id,
        })),
      })),
    },
  ];

  return {
    reel: reelLabel,
    planPath,
    words,
    cards,
    questions,
    editCost:
      'Editing a word changes the transcript hash, so the keyword and image-slot caches will ' +
      'miss and a later run bills for them again. Timing, restore and script edits do not: ' +
      'neither hash covers a word\'s script.',
    transcriptHash: hashTranscript(plan.transcript.words),
  };
}

export interface WordEdit {
  planPath: string;
  wordId: string;
  /** New display text. Omitted for a restore. */
  text?: string;
  /** Bring a removed word back. */
  restore?: boolean;
  /** Flip how the word is written, which decides its direction and its font. */
  script?: 'latin' | 'arabic';
}

/**
 * Writes one word edit. **Ids and order never change**, and `edited` is set so
 * `PlanMergeBlockedError` will refuse to discard the work on a re-run — which is
 * what makes editing safe to do before running again.
 */
export async function editWord(edit: WordEdit): Promise<{ word: TranscriptWordView; hash: string }> {
  const plan = await readEditPlan(edit.planPath);
  const word = plan.transcript.words.find((w) => w.id === edit.wordId);
  if (word === undefined) {
    throw new TranscriptViewError(`no word "${edit.wordId}" in ${edit.planPath}`);
  }
  if (edit.text !== undefined) {
    if (edit.text.trim() === '') {
      throw new TranscriptViewError(
        'a word cannot be emptied; mark it removed instead so the card can still be built',
      );
    }
    word.text = edit.text;
  }
  if (edit.restore === true) {
    word.removed = false;
    word.removedReason = null;
  }
  if (edit.script !== undefined && edit.script !== word.script) {
    word.script = edit.script;
    /*
     * The template variant follows the script — `sub_pop` for Latin,
     * `sub_pop_ar` for Arabic — and that is what decides the font the builder
     * uses. Flipping the script without moving the card would leave Arabic to
     * be drawn in Inter, so the pairing is applied here rather than left for a
     * re-run that may never happen.
     */
    for (const group of plan.subtitles.groups) {
      if (!group.wordIds.includes(word.id) || group.templateId === null) continue;
      group.templateId = scriptVariantOf(group.templateId, edit.script);
      group.edited = true;
    }
  }
  word.edited = true;
  plan.meta.updatedAt = new Date().toISOString();
  await writeEditPlan(edit.planPath, plan);

  const view = await transcriptViewForPlan(edit.planPath);
  const updated = view.words.find((w) => w.id === edit.wordId) as TranscriptWordView;
  return { word: updated, hash: view.transcriptHash };
}

/**
 * The same template in the other script, by the `_ar` suffix the assigner uses.
 * Unknown pairings are left alone: a template with no counterpart is a template
 * the builder still knows how to draw, and inventing an id would not be.
 */
export function scriptVariantOf(templateId: string, script: 'latin' | 'arabic'): string {
  const base = templateId.endsWith(SCRIPT_VARIANT_SUFFIX)
    ? templateId.slice(0, -SCRIPT_VARIANT_SUFFIX.length)
    : templateId;
  const wanted = script === 'arabic' ? `${base}${SCRIPT_VARIANT_SUFFIX}` : base;
  return templatesById(loadTemplateManifest()).has(wanted) ? wanted : templateId;
}

export interface CardEdit {
  planPath: string;
  cardId: string;
  displayStart: number;
  displayEnd: number;
}

/**
 * Adjusts how long a card is on screen. **Word timings are never touched** —
 * they are what was said and when, and the display window is a separate
 * decision the schema has carried since Block 3.
 */
export async function editCard(edit: CardEdit): Promise<TranscriptCardView> {
  const plan = await readEditPlan(edit.planPath);
  const card = plan.subtitles.groups.find((g) => g.id === edit.cardId);
  if (card === undefined) {
    throw new TranscriptViewError(`no card "${edit.cardId}" in ${edit.planPath}`);
  }
  if (!(edit.displayEnd > edit.displayStart)) {
    throw new TranscriptViewError(
      `a card must end after it starts; got ${edit.displayStart} to ${edit.displayEnd}`,
    );
  }
  card.displayStart = edit.displayStart;
  card.displayEnd = edit.displayEnd;
  card.edited = true;
  plan.meta.updatedAt = new Date().toISOString();
  await writeEditPlan(edit.planPath, plan);

  const view = await transcriptViewForPlan(edit.planPath);
  return view.cards.find((c) => c.id === edit.cardId) as TranscriptCardView;
}
