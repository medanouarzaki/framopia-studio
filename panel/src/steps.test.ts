import { describe, expect, it } from 'vitest';
import { reconcileStep, stepViews, STEP_ORDER } from './steps.js';
import type { PlanSteps, StepId, StepState } from './types.js';

function step(id: StepId, available: boolean): StepState {
  return {
    id,
    label: id,
    available,
    reason: available ? null : `${id} has not run`,
    summary: available ? `${id} summary` : null,
  };
}

function plan(upTo: StepId, resumeAt: StepId): PlanSteps {
  const cut = STEP_ORDER.indexOf(upTo);
  return {
    reel: 'vitasilk',
    planPath: '/v/p.json',
    steps: STEP_ORDER.map((id, i) => step(id, i <= cut)),
    resumeAt,
  };
}

describe('stepViews', () => {
  it('renders all five steps with no plan, only the first reachable', () => {
    const views = stepViews(null, 'reel');
    expect(views.map((v) => v.id)).toEqual(STEP_ORDER);
    expect(views.map((v) => v.available)).toEqual([true, false, false, false, false]);
    expect(views[1]?.reason).toContain('Pick a video');
  });

  it('carries the plan’s own reason and summary through', () => {
    const views = stepViews(plan('transcript', 'transcript'), 'transcript');
    expect(views[1]?.summary).toBe('transcript summary');
    expect(views[2]?.reason).toBe('keywords has not run');
  });

  it('marks exactly one step current', () => {
    const views = stepViews(plan('build', 'build'), 'images');
    expect(views.filter((v) => v.current).map((v) => v.id)).toEqual(['images']);
  });

  it('keeps Reel reachable even when the service says nothing about it', () => {
    const empty = { ...plan('reel', 'reel'), steps: [] } as PlanSteps;
    expect(stepViews(empty, 'reel')[0]?.available).toBe(true);
  });
});

describe('reconcileStep', () => {
  it('opens where the plan says the reel is, before the user navigates', () => {
    expect(reconcileStep(plan('keywords', 'keywords'), 'reel', false)).toBe('keywords');
  });

  it('keeps the user’s choice once they have navigated', () => {
    expect(reconcileStep(plan('build', 'build'), 'transcript', true)).toBe('transcript');
  });

  it('moves off a step the plan no longer supports', () => {
    expect(reconcileStep(plan('transcript', 'transcript'), 'images', true)).toBe('transcript');
  });

  it('falls back to Reel with no plan', () => {
    expect(reconcileStep(null, 'images', true)).toBe('reel');
  });

  /*
   * The panel is the only surface the user has. A malformed answer from the
   * service must leave a locked rail, never an unmounted React tree — the same
   * rule that keeps the startup path from throwing, applied to the service's
   * replies.
   */
  it('survives a payload with no steps array', () => {
    const broken = { reel: 'v', planPath: null, resumeAt: 'images' } as unknown as PlanSteps;
    expect(() => stepViews(broken, 'reel')).not.toThrow();
    expect(reconcileStep(broken, 'images', true)).toBe('reel');
  });

  it('survives a resumeAt the panel does not know', () => {
    const odd = { ...plan('build', 'build'), resumeAt: 'zones' as StepId };
    expect(reconcileStep(odd, 'reel', false)).toBe('reel');
  });
});
