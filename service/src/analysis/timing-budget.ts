import type { TemplateEntry, TemplateKind } from '@framopia/core';
import type { EditPlan, SubtitleGroup } from '../editplan/types.js';
import { checkBuildability } from './buildability.js';
import { applyDisplayTiming } from './display-timing.js';
import { cardMinimumDurationS } from '../build/short-card.js';

/**
 * How short a template's intro and outro have to be for the content that
 * already exists to be buildable.
 *
 * The question is asked before the comps are animated, so it is asked of the
 * timing budget rather than of any particular template: every element is
 * measured against one caller-supplied (intro, outro, minHold) triple, and the
 * template ids the plans carry are replaced with synthetic ones pointing at
 * it. Only the sum intro + minHold + outro is ever compared, so how a budget
 * is split between intro and outro does not affect any number here.
 *
 * Read-only. Nothing is written back to a plan, and the derived groups exist
 * only inside this module.
 */

/** Frames at 29.97: 4, 6, 8, 10, 12. */
export const INTRO_OUTRO_TOTALS_S = [0.13, 0.2, 0.27, 0.33, 0.4];
export const MIN_HOLDS_S = [0.1, 0.15, 0.2, 0.25, 0.3];

const SWEEP_TEMPLATE_IDS: Record<TemplateKind, string> = {
  subtitle: 'sweep_subtitle',
  keyword: 'sweep_keyword',
  image: 'sweep_image',
};

function sweepTemplate(kind: TemplateKind, introOutroS: number, minHoldS: number): TemplateEntry {
  return {
    id: SWEEP_TEMPLATE_IDS[kind],
    file: '',
    type: kind,
    placeholders: [],
    /*
     * The whole budget is the entrance, matching the built templates, which
     * all declare `outroS: 0` (Block 6 session 7's ruling — a card hard-cuts
     * into the next one).
     *
     * **The split is no longer arbitrary.** It used to be halved with a comment
     * saying only the sum was read; that stopped being true when the
     * short-card rule began compressing the *entrance* alone. Halved, the
     * sweep reported a 0.23 s floor where the builder uses 0.118 s, and said
     * 120 cards failed where 28 do.
     */
    introS: introOutroS,
    outroS: 0,
    minHoldS,
    anchor: '',
    imagePresentation: null,
    sfx: [],
    notes: '',
  };
}

export function sweepTemplates(
  introOutroS: number,
  minHoldS: number,
): Map<string, TemplateEntry> {
  const kinds: TemplateKind[] = ['subtitle', 'keyword', 'image'];
  return new Map(
    kinds.map((kind) => [SWEEP_TEMPLATE_IDS[kind], sweepTemplate(kind, introOutroS, minHoldS)]),
  );
}

export interface Tally {
  buildable: number;
  total: number;
}

export interface BudgetFailure {
  path: string;
  shortByS: number;
  /** Set for subtitle groups, which the user has to find and look at. */
  groupId?: string;
  text?: string;
  haveS?: number;
}

export interface BudgetCell {
  introOutroS: number;
  minHoldS: number;
  floorS: number;
  groups: Tally;
  keywords: Tally;
  slots: Tally;
  /** Groups the display-timing pass merged to reach the floor. */
  merges: number;
  failures: BudgetFailure[];
}

const percent = (t: Tally): number => (t.total === 0 ? 100 : (t.buildable / t.total) * 100);

export function tallyPercent(t: Tally): number {
  return percent(t);
}

/**
 * One cell of the grid, for one plan.
 *
 * Display timing is **re-derived from the words' speech timings** at this
 * budget rather than read from the plan. The stored `displayStart`/`displayEnd`
 * were derived against the stub manifest's floor, so reading them would
 * measure the stub's assumptions instead of the budget under test.
 */
export function evaluateBudget(
  plan: EditPlan,
  introOutroS: number,
  minHoldS: number,
): BudgetCell {
  const templates = sweepTemplates(introOutroS, minHoldS);

  // Every element points at the sweep template for its kind. The plans carry a
  // mix of stub ids and nulls, and a null would be reported as "no templateId
  // assigned" rather than measured against the budget.
  const groups: SubtitleGroup[] = plan.subtitles.groups.map((g) => ({
    ...g,
    templateId: SWEEP_TEMPLATE_IDS.subtitle,
    displayStart: undefined,
    displayEnd: undefined,
  }));

  const derived = applyDisplayTiming({
    groups,
    templates,
    reelDurationS: plan.source.durationS,
  });

  const candidate: EditPlan = {
    ...plan,
    subtitles: { ...plan.subtitles, groups: derived.groups },
    keywords: {
      ...plan.keywords,
      items: plan.keywords.items.map((k) => ({ ...k, templateId: SWEEP_TEMPLATE_IDS.keyword })),
    },
    images: {
      ...plan.images,
      slots: plan.images.slots.map((s) => ({ ...s, templateId: SWEEP_TEMPLATE_IDS.image })),
    },
  };

  const wordText = new Map(plan.transcript.words.map((w) => [w.id, w.text]));
  const report = checkBuildability(candidate, templates);
  // Only duration failures answer this question. checkBuildability also reports
  // keyword-to-group alignment and slot overlap, which the re-derivation can
  // disturb by renumbering and which are not what a timing budget decides.
  const durationIssues = report.issues.filter((i) => i.shortByS !== undefined);
  const failedIn = (prefix: string): number =>
    durationIssues.filter((i) => i.path.startsWith(prefix)).length;

  // What a card actually has to clear, with the entrance compressed as far as
  // it may — not the nominal budget.
  const floorS = cardMinimumDurationS(introOutroS, minHoldS);
  return {
    introOutroS,
    minHoldS,
    floorS,
    groups: {
      total: derived.groups.length,
      buildable: derived.groups.length - failedIn('subtitles.groups'),
    },
    keywords: {
      total: candidate.keywords.items.length,
      buildable: candidate.keywords.items.length - failedIn('keywords.items'),
    },
    slots: {
      total: candidate.images.slots.length,
      buildable: candidate.images.slots.length - failedIn('images.slots'),
    },
    merges: derived.merged.length,
    failures: durationIssues.map((i) => {
      const failure: BudgetFailure = { path: i.path, shortByS: i.shortByS as number };
      const match = /^subtitles\.groups\[(\d+)\]$/.exec(i.path);
      const group = match ? derived.groups[Number(match[1])] : undefined;
      if (group) {
        failure.groupId = group.id;
        failure.text = group.wordIds.map((id) => wordText.get(id) ?? '?').join(' ');
        failure.haveS = (group.displayEnd ?? group.end) - (group.displayStart ?? group.start);
      }
      return failure;
    }),
  };
}

export function sweepPlan(plan: EditPlan): BudgetCell[] {
  const cells: BudgetCell[] = [];
  for (const introOutroS of INTRO_OUTRO_TOTALS_S) {
    for (const minHoldS of MIN_HOLDS_S) {
      cells.push(evaluateBudget(plan, introOutroS, minHoldS));
    }
  }
  return cells;
}

export interface Spread {
  min: number;
  p10: number;
  median: number;
  max: number;
  n: number;
}

/** Nearest-rank percentile: no interpolation, so every figure is an observed value. */
export function spread(values: number[]): Spread {
  if (values.length === 0) return { min: 0, p10: 0, median: 0, max: 0, n: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number): number =>
    sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))] as number;
  return {
    min: sorted[0] as number,
    p10: at(0.1),
    median: at(0.5),
    max: sorted[sorted.length - 1] as number,
    n: sorted.length,
  };
}

/** How long each group's words actually took to say. */
export function groupSpeechDurations(plan: EditPlan): number[] {
  return plan.subtitles.groups.map((g) => g.end - g.start);
}

/**
 * Silence after each group, which is the headroom display timing may extend
 * into. The last group's headroom runs to the end of the reel.
 */
export function groupSilenceGaps(plan: EditPlan): number[] {
  const groups = plan.subtitles.groups;
  return groups.map((g, i) => {
    const next = groups[i + 1];
    return (next?.start ?? plan.source.durationS) - g.end;
  });
}

export interface ShortestGroup {
  id: string;
  text: string;
  durationS: number;
  gapAfterS: number;
}

export function shortestGroup(plan: EditPlan): ShortestGroup | null {
  const groups = plan.subtitles.groups;
  if (groups.length === 0) return null;
  const byWord = new Map(plan.transcript.words.map((w) => [w.id, w.text]));
  const gaps = groupSilenceGaps(plan);
  let best = 0;
  groups.forEach((g, i) => {
    if (g.end - g.start < (groups[best] as SubtitleGroup).end - (groups[best] as SubtitleGroup).start) {
      best = i;
    }
  });
  const group = groups[best] as SubtitleGroup;
  return {
    id: group.id,
    text: group.wordIds.map((id) => byWord.get(id) ?? '?').join(' '),
    durationS: group.end - group.start,
    gapAfterS: gaps[best] as number,
  };
}
