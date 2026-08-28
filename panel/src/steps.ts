import type { PlanSteps, StepId, StepState } from './types.js';

/**
 * The five steps, in order, as PROJECT_SPEC §6 lists the workflow.
 *
 * Declared here so the rail can render all five before any reel is picked —
 * the user should see the shape of the job on an empty panel, not discover it
 * one step at a time.
 */
export const STEP_ORDER: StepId[] = ['reel', 'transcript', 'keywords', 'images', 'build'];

export const STEP_LABELS: Record<StepId, string> = {
  reel: 'Reel',
  transcript: 'Transcript',
  keywords: 'Keywords',
  images: 'Images',
  build: 'Build',
};

/** What each step will hold, said plainly while it holds nothing yet. */
export const STEP_PROMISE: Record<StepId, string> = {
  reel: 'Pick the video and the client mode, and see what a run would cost.',
  transcript:
    'Edit words, toggle script, adjust card grouping, and restore anything cleaning removed.',
  keywords: 'Choose which words are emphasised, and switch between automatic and proposed.',
  images: 'Review the generated candidates per slot and pick one, or regenerate with a tweak.',
  build: 'Check the plan is complete and build the composition in After Effects.',
};

export interface StepView {
  id: StepId;
  label: string;
  available: boolean;
  reason: string | null;
  summary: string | null;
  current: boolean;
}

/**
 * The rail's five entries, whether or not a plan has been read.
 *
 * With no plan every step past `reel` is unreachable and says why, rather than
 * vanishing: a step that disappears when it is not ready teaches nobody what
 * the tool does.
 */
export function stepViews(plan: PlanSteps | null, current: StepId): StepView[] {
  const fromService = planSteps(plan);
  return STEP_ORDER.map((id) => {
    const fromPlan: StepState | undefined = fromService.find((s) => s.id === id);
    const available = id === 'reel' ? true : (fromPlan?.available ?? false);
    return {
      id,
      label: STEP_LABELS[id],
      available,
      reason:
        fromPlan?.reason ??
        (id === 'reel' ? null : 'Pick a video and a client mode first.'),
      summary: fromPlan?.summary ?? null,
      current: id === current,
    };
  });
}

/**
 * Where to move when the plan changes. A step the plan no longer supports must
 * not stay current — selecting a different reel from Images would otherwise
 * leave the panel on a step that reel has never reached.
 */
export function reconcileStep(plan: PlanSteps | null, current: StepId, touched: boolean): StepId {
  const steps = planSteps(plan);
  if (plan === null || steps.length === 0) return 'reel';
  const resumeAt = STEP_ORDER.includes(plan.resumeAt) ? plan.resumeAt : 'reel';
  // Until the user has navigated, follow the plan: the panel opens where the
  // reel actually is, which is the whole point of deriving this from disk.
  if (!touched) return resumeAt;
  const step = steps.find((s) => s.id === current);
  return step?.available === true ? current : resumeAt;
}

/**
 * The service's step list, or nothing.
 *
 * A payload without `steps` is not a shape the service produces, but the panel
 * is the only surface the user has and a malformed answer must degrade to a
 * locked rail rather than an unmounted React tree. Part 1 lost sessions to
 * throws on the panel's own path; this is the same rule applied to the
 * service's.
 */
function planSteps(plan: PlanSteps | null): StepState[] {
  return Array.isArray(plan?.steps) ? plan.steps : [];
}
