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
  issues: string[];
  current: boolean;
}

/**
 * The rail's five entries, whether or not a plan has been read.
 *
 * With no plan every step past `reel` is unreachable and says why, rather than
 * vanishing: a step that disappears when it is not ready teaches nobody what
 * the tool does.
 */
export function stepViews(
  plan: PlanSteps | null,
  current: StepId,
  selection: { reel: boolean; mode: boolean } = { reel: false, mode: false },
): StepView[] {
  const fromService = planSteps(plan);
  return STEP_ORDER.map((id) => {
    const fromPlan: StepState | undefined = fromService.find((s) => s.id === id);
    const available = id === 'reel' ? true : (fromPlan?.available ?? false);
    return {
      id,
      label: STEP_LABELS[id],
      available,
      reason: fromPlan?.reason ?? (id === 'reel' ? null : fallbackReason(selection)),
      summary: fromPlan?.summary ?? null,
      issues: fromPlan?.issues ?? [],
      current: id === current,
    };
  });
}

/**
 * Why a step is unreachable when the service has said nothing about it.
 *
 * It used to be "Pick a video and a client mode first." unconditionally, which
 * the user saw **with both already picked** — the panel was talking to a
 * service too old to have the route, so no plan ever arrived and every step
 * fell back to a sentence about a choice he had already made. A message must
 * describe the situation it is shown in.
 */
function fallbackReason(selection: { reel: boolean; mode: boolean }): string {
  if (!selection.reel && !selection.mode) return 'Pick a video and a client mode first.';
  if (!selection.reel) return 'Pick a video first.';
  if (!selection.mode) return 'Pick a client mode first.';
  return 'Waiting for the service to report what this reel has been through.';
}

/**
 * Where to be when the plan changes.
 *
 * **Selecting a reel or a mode never moves the user.** It used to jump straight
 * to the furthest step the plan supported, which hid every step in between and
 * was the opposite of what picking a video means. The rail updates
 * availability; the user chooses where to go.
 *
 * The one automatic move is away from a step the plan no longer supports —
 * switching from a reel with images to one without cannot leave the panel on
 * Images. It falls back to the last step that reel *has* remembered being on,
 * and to step one otherwise.
 */
export function reconcileStep(plan: PlanSteps | null, current: StepId, remembered: StepId | null): StepId {
  const steps = planSteps(plan);
  if (plan === null || steps.length === 0) return 'reel';

  const available = (id: StepId | null): boolean =>
    id !== null && steps.find((s) => s.id === id)?.available === true;

  if (available(current)) return current;
  if (available(remembered)) return remembered as StepId;
  return 'reel';
}

/**
 * The step to show when a reel is first selected: the one last viewed for that
 * reel, if the plan still supports it.
 *
 * This is a **view preference, not a fact about the plan**, so it lives in the
 * panel and never reaches the Edit Plan. Two people opening the same reel are
 * entitled to be looking at different steps.
 */
export function openingStep(plan: PlanSteps | null, remembered: StepId | null): StepId {
  const steps = planSteps(plan);
  if (remembered === null) return 'reel';
  return steps.find((s) => s.id === remembered)?.available === true ? remembered : 'reel';
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

/**
 * The step last viewed per reel, remembered across panel reloads.
 *
 * Closing a CEP panel unloads the page, so React state does not survive it and
 * "reopening restores where you were" needs storage. `localStorage` is the
 * panel's own state — a view preference, never a fact about the plan, so it
 * does not belong in the Edit Plan: two people opening the same reel are
 * entitled to be looking at different steps.
 *
 * Every access is guarded. The API exists in CEP's Chromium 99, but a page
 * loaded from `file://` with site data disabled throws on the accessor itself
 * rather than returning null, and a panel must not fail to render over a
 * remembered tab.
 */
const LAST_STEP_KEY = 'framopia.panel.last-step';

export function readLastSteps(): Record<string, StepId> {
  try {
    const raw = window.localStorage.getItem(LAST_STEP_KEY);
    if (raw === null) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, StepId> = {};
    for (const [reel, step] of Object.entries(parsed)) {
      if (typeof step === 'string' && (STEP_ORDER as string[]).includes(step)) {
        out[reel] = step as StepId;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function writeLastSteps(value: Record<string, StepId>): void {
  try {
    window.localStorage.setItem(LAST_STEP_KEY, JSON.stringify(value));
  } catch {
    // A remembered step is a convenience; losing it is not worth a failure.
  }
}
