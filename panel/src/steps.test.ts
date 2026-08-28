import { describe, expect, it } from 'vitest';
import { openingStep, reconcileStep, stepViews, STEP_ORDER } from './steps.js';
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

function plan(upTo: StepId): PlanSteps {
  const cut = STEP_ORDER.indexOf(upTo);
  return {
    reel: 'vitasilk',
    planPath: '/v/p.json',
    steps: STEP_ORDER.map((id, i) => step(id, i <= cut)),
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
    const views = stepViews(plan('transcript'), 'transcript');
    expect(views[1]?.summary).toBe('transcript summary');
    expect(views[2]?.reason).toBe('keywords has not run');
  });

  it('marks exactly one step current', () => {
    const views = stepViews(plan('build'), 'images');
    expect(views.filter((v) => v.current).map((v) => v.id)).toEqual(['images']);
  });

  it('keeps Reel reachable even when the service says nothing about it', () => {
    const empty = { ...plan('reel'), steps: [] } as PlanSteps;
    expect(stepViews(empty, 'reel')[0]?.available).toBe(true);
  });
});

describe('reconcileStep', () => {
  /*
   * Picking a reel used to jump to the furthest step the plan supported, which
   * hid every step in between and left Build open on a reel with no keywords.
   * The rail updates; the user navigates.
   */
  it('does not move the user when a plan arrives', () => {
    expect(reconcileStep(plan('build'), 'reel', null)).toBe('reel');
    expect(reconcileStep(plan('keywords'), 'reel', null)).toBe('reel');
  });

  it('keeps the current step when the plan still supports it', () => {
    expect(reconcileStep(plan('build'), 'transcript', null)).toBe('transcript');
  });

  it('moves off a step the plan no longer supports', () => {
    expect(reconcileStep(plan('transcript'), 'images', null)).toBe('reel');
  });

  it('prefers the remembered step over step one when it has to move', () => {
    expect(reconcileStep(plan('keywords'), 'images', 'transcript')).toBe('transcript');
  });

  it('falls back to Reel when neither the current nor the remembered step is available', () => {
    expect(reconcileStep(plan('transcript'), 'images', 'build')).toBe('reel');
  });

  it('falls back to Reel with no plan', () => {
    expect(reconcileStep(null, 'images', 'images')).toBe('reel');
  });

  /*
   * The panel is the only surface the user has. A malformed answer from the
   * service must leave a locked rail, never an unmounted React tree — the same
   * rule that keeps the startup path from throwing, applied to the service's
   * replies.
   */
  it('survives a payload with no steps array', () => {
    const broken = { reel: 'v', planPath: null } as unknown as PlanSteps;
    expect(() => stepViews(broken, 'reel')).not.toThrow();
    expect(reconcileStep(broken, 'images', null)).toBe('reel');
  });
});

/**
 * Which step a reel opens on is a **view preference**, remembered per reel in
 * the panel and never written to the Edit Plan: two people opening the same
 * reel are entitled to be looking at different steps.
 */
describe('openingStep', () => {
  it('restores the step last viewed for that reel', () => {
    expect(openingStep(plan('build'), 'keywords')).toBe('keywords');
  });

  it('falls back to Reel when the remembered step is no longer available', () => {
    expect(openingStep(plan('transcript'), 'images')).toBe('reel');
  });

  it('opens on Reel when nothing is remembered', () => {
    expect(openingStep(plan('build'), null)).toBe('reel');
  });
});
