import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { loadTemplateManifest, REPO_ROOT, templatesById } from '@framopia/core';
import { checkBuildability } from './buildability.js';
import { readEditPlan } from '../editplan/io.js';
import type { SfxEvent } from '../editplan/types.js';

/*
 * A sound whose lead-in is longer than the reel in front of its element starts
 * before the composition, and After Effects honours that — observed in the
 * Block 8 session 28 probe. This used to be reported as a buildability issue,
 * which was true while the placement clamped and false once it stopped.
 */
describe('an sfx event that starts before the composition', () => {
  it('is not a buildability issue', async () => {
    const plan = await readEditPlan(
      path.join(REPO_ROOT, 'my files', 'test videos', 'vitasilk.editplan.json'),
    );
    const early = plan.sfx.events.filter((e) => e.timeS < 0);
    expect(early.length).toBeGreaterThan(0);
    const issues = checkBuildability(plan, templatesById(loadTemplateManifest())).issues;
    expect(issues.filter((i) => i.path === 'sfx.events')).toEqual([]);
  });

  it('is still an issue when the time is not a number', async () => {
    const plan = await readEditPlan(
      path.join(REPO_ROOT, 'my files', 'test videos', 'vitasilk.editplan.json'),
    );
    plan.sfx.events[0] = { ...(plan.sfx.events[0] as SfxEvent), timeS: Number.NaN };
    const issues = checkBuildability(plan, templatesById(loadTemplateManifest())).issues;
    expect(issues.some((i) => i.path === 'sfx.events')).toBe(true);
  });
});
