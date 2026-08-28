import { existsSync, readFileSync } from 'node:fs';
import { buildFonts, loadMode, loadTemplateManifest, templatesById } from '@framopia/core';
import { listReels } from './catalogue.js';
import { checkBuildability } from './analysis/buildability.js';
import type { EditPlan } from './editplan/types.js';

/**
 * Where a reel actually is, derived from the Edit Plan on disk.
 *
 * The panel is a view over the plan, not a wizard holding its own progress.
 * Closing the panel, restarting After Effects or reloading the extension must
 * land the user on the step the reel is really at, and the only thing that
 * survives all three is the plan — so every step's availability and every
 * summary figure is computed here, from the plan's own `pipeline` bookkeeping
 * and its contents, and the panel renders what it is told.
 *
 * It runs nothing and bills nothing.
 */
export const STEP_IDS = ['reel', 'transcript', 'keywords', 'images', 'build'] as const;
export type StepId = (typeof STEP_IDS)[number];

export interface StepState {
  id: StepId;
  label: string;
  /** Whether the plan supports opening this step at all. */
  available: boolean;
  /** Why not, in the words the panel shows. Null when available. */
  reason: string | null;
  /** Real figures already on the plan. Null when there are none yet. */
  summary: string | null;
  /**
   * Things the plan cannot build cleanly, named rather than counted. "5
   * buildability issue(s)" tells a user a number and nothing they can act on.
   */
  issues?: string[];
}

export interface PlanSteps {
  reel: string;
  planPath: string | null;
  steps: StepState[];
}

export class StepsError extends Error {}

const LABELS: Record<StepId, string> = {
  reel: 'Reel',
  transcript: 'Transcript',
  keywords: 'Keywords',
  images: 'Images',
  build: 'Build',
};

function countCandidatesOnDisk(plan: EditPlan): { total: number; present: number } {
  let total = 0;
  let present = 0;
  for (const slot of plan.images.slots) {
    for (const candidate of slot.candidates) {
      total += 1;
      if (candidate.path !== '' && existsSync(candidate.path)) present += 1;
    }
  }
  return { total, present };
}

export function stepsFor(reelLabel: string, modeId: string): PlanSteps {
  const reel = listReels().find((r) => r.label === reelLabel);
  if (reel === undefined) {
    throw new StepsError(`no reel labelled "${reelLabel}" in benchmarks/footage.json`);
  }

  let mode;
  try {
    mode = loadMode(modeId);
  } catch (error) {
    throw new StepsError(`mode "${modeId}" did not load: ${(error as Error).message}`);
  }

  const planPath = reel.planPath;
  let plan: EditPlan | null = null;
  if (planPath !== null && existsSync(planPath)) {
    try {
      plan = JSON.parse(readFileSync(planPath, 'utf8')) as EditPlan;
    } catch (error) {
      throw new StepsError(`${planPath} did not parse: ${(error as Error).message}`);
    }
  }

  const steps: StepState[] = [];
  const push = (
    id: StepId,
    available: boolean,
    reason: string | null,
    summary: string | null,
    issues: string[] = [],
  ): void => {
    steps.push({ id, label: LABELS[id], available, reason, summary, ...(issues.length > 0 ? { issues } : {}) });
  };

  push('reel', true, null, `${reel.label}${reel.durationS === null ? '' : ` — ${reel.durationS.toFixed(1)}s`}`);

  const transcriptionDone = plan?.pipeline.transcription.status === 'done';
  if (plan === null) {
    push('transcript', false, 'This reel has no edit plan yet. Run the pipeline first.', null);
    push('keywords', false, 'Nothing has been transcribed yet.', null);
    push('images', false, 'Nothing has been transcribed yet.', null);
    push('build', false, 'Nothing has been transcribed yet.', null);
    return { reel: reel.label, planPath, steps };
  }

  const words = plan.transcript.words.length;
  const cards = plan.subtitles.groups.length;
  const superseded = plan.subtitles.groups.filter((g) => g.supersededBy != null).length;
  const stage = plan.pipeline.transcription;
  const provenance =
    stage.cacheProvenance === 'compatible'
      ? ' Reused a transcription made against an older orthography guide.'
      : '';
  push(
    'transcript',
    transcriptionDone,
    transcriptionDone ? null : 'This reel has not been transcribed yet.',
    transcriptionDone
      ? `${words} words in ${cards} cards, ${cards - superseded} rendered.${provenance}`
      : null,
  );

  const keywordsDone = plan.pipeline.analysis.status === 'done' && plan.keywords.items.length > 0;
  push(
    'keywords',
    keywordsDone,
    keywordsDone ? null : 'Keyword analysis has not run for this reel.',
    keywordsDone
      ? `${plan.keywords.items.length} keywords, ${plan.keywords.items.filter((k) => k.approved).length} approved.`
      : null,
  );

  const slots = plan.images.slots.length;
  const candidates = countCandidatesOnDisk(plan);
  push(
    'images',
    slots > 0,
    slots > 0 ? null : 'No image slots have been planned for this reel.',
    slots > 0
      ? `${slots} slots, ${candidates.total} candidates, ${candidates.present} on disk.`
      : null,
  );

  /*
   * **A subtitles-only comp is a legitimate build, so Build opens on cards.**
   * Session 15's brief said "the plan-completeness check passes" and the code
   * shipped "there are cards" without declaring the difference; this states the
   * rule rather than leaving a third one undeclared.
   *
   * The reason is that keywords and images are enrichments, not requirements:
   * `buildReel` places whatever the plan carries and PROJECT_SPEC's deliverable
   * is a comp for human review. `ground-truth` has no keywords and no images
   * and still builds 76 subtitle cards, which is a useful thing to look at.
   * What the pane must not do is imply the comp will contain more than it will
   * — so the summary says what is in and what is missing.
   *
   * `checkBuildability`'s issues are clipped holds and short words, which the
   * builder handles by compressing an entrance. They are reported, never a gate.
   */
  let buildAvailable = false;
  let buildReason: string | null = null;
  let buildSummary: string | null = null;
  let buildIssues: string[] = [];
  const fonts = buildFonts(mode);
  try {
    const report = checkBuildability(plan, templatesById(loadTemplateManifest()));
    buildAvailable = report.checked.subtitleGroups > 0;
    buildReason = buildAvailable ? null : 'There are no subtitle cards to build.';

    const willContain = [`${report.checked.subtitleGroups} subtitle cards`];
    const willNot: string[] = [];
    const part = (n: number, singular: string, plural: string): void => {
      if (n > 0) willContain.push(`${n} ${n === 1 ? singular : plural}`);
      else willNot.push(plural);
    };
    part(plan.keywords.items.length, 'emphasised keyword', 'emphasised keywords');
    part(candidates.present > 0 ? slots : 0, 'image', 'images');
    part(plan.sfx.events.length, 'sfx event', 'sfx events');

    buildIssues = report.issues.map((i) =>
      i.shortByS === undefined
        ? `${i.path}: ${i.message}`
        : `${i.path}: ${i.message} (short by ${i.shortByS.toFixed(2)}s)`,
    );

    buildSummary =
      `Would contain ${willContain.join(', ')}` +
      (willNot.length === 0 ? '' : `; no ${willNot.join(' and no ')}`) +
      `. Fonts: ${fonts.latin} and ${fonts.arabic}` +
      `${fonts.source === 'global' ? ' (global fallback)' : ''}.`;
  } catch (error) {
    buildReason = `The template manifest did not load: ${(error as Error).message}`;
  }
  push('build', buildAvailable, buildReason, buildSummary, buildIssues);

  return { reel: reel.label, planPath, steps };
}
