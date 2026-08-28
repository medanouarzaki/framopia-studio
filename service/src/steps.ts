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
}

export interface PlanSteps {
  reel: string;
  planPath: string | null;
  steps: StepState[];
  /** The furthest available step: where the panel opens for this reel. */
  resumeAt: StepId;
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
  const push = (id: StepId, available: boolean, reason: string | null, summary: string | null): void => {
    steps.push({ id, label: LABELS[id], available, reason, summary });
  };

  push('reel', true, null, `${reel.label}${reel.durationS === null ? '' : ` — ${reel.durationS.toFixed(1)}s`}`);

  const transcriptionDone = plan?.pipeline.transcription.status === 'done';
  if (plan === null) {
    push('transcript', false, 'This reel has no edit plan yet. Run the pipeline first.', null);
    push('keywords', false, 'Nothing has been transcribed yet.', null);
    push('images', false, 'Nothing has been transcribed yet.', null);
    push('build', false, 'Nothing has been transcribed yet.', null);
    return { reel: reel.label, planPath, steps, resumeAt: 'reel' };
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

  let buildAvailable = false;
  let buildReason: string | null = 'The plan is not complete enough to build.';
  let buildSummary: string | null = null;
  const fonts = buildFonts(mode);
  try {
    const report = checkBuildability(plan, templatesById(loadTemplateManifest()));
    // The step opens whenever there is something to build. Buildability issues
    // are clipped holds and short words, which the builder handles by
    // compressing an entrance — they are worth showing, not worth locking a
    // step behind.
    buildAvailable = report.checked.subtitleGroups > 0;
    buildReason = buildAvailable ? null : 'There are no subtitle cards to build.';
    buildSummary = `${fonts.latin} and ${fonts.arabic}${fonts.source === 'global' ? ' (global fallback)' : ''}. ${report.issues.length} buildability issue(s).`;
  } catch (error) {
    buildReason = `The template manifest did not load: ${(error as Error).message}`;
  }
  push('build', buildAvailable, buildReason, buildSummary);

  /*
   * The end of the unbroken run of available steps, not the furthest available
   * one. `build` is available whenever there are cards, so taking the last
   * would open a reel with no keywords straight on Build and skip the gap that
   * is the actual next thing to do.
   */
  let resumeAt: StepId = 'reel';
  for (const step of steps) {
    if (!step.available) break;
    resumeAt = step.id;
  }
  return { reel: reel.label, planPath, steps, resumeAt };
}
