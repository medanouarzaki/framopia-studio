import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';
import { analysisConfigLabel, modeFromConfigLabel, slotConfigLabel } from './job.js';
import { readEditPlan } from '../editplan/io.js';

const mode = { id: 'k2-syndicalia', version: 7 } as never;

/*
 * `plan.clientMode` was null on every plan for five sessions while the answer
 * sat in the config label the analysis stage had already written. The parse
 * lives beside the two writers so the format cannot move in one place only.
 */
describe('the mode a stage recorded', () => {
  it('round-trips both labels', () => {
    expect(modeFromConfigLabel(analysisConfigLabel(3, mode))).toEqual({
      id: 'k2-syndicalia',
      version: 7,
    });
    expect(modeFromConfigLabel(slotConfigLabel(1, mode))).toEqual({
      id: 'k2-syndicalia',
      version: 7,
    });
  });

  /* A mode id contains hyphens, so the version is the last one, not the first. */
  it('reads the version from the end, not from the id', () => {
    expect(modeFromConfigLabel('keywords-prompt-v4-a-b-v2-v11')).toEqual({
      id: 'a-b-v2',
      version: 11,
    });
  });

  it('returns null rather than guessing at anything else', () => {
    for (const bad of [null, undefined, '', 'keywords-prompt-v3', 'nonsense', 'slots-prompt-vX-m-v1']) {
      expect(modeFromConfigLabel(bad), String(bad)).toBeNull();
    }
  });

  it('reproduces the labels the corpus actually carries', () => {
    expect(modeFromConfigLabel('keywords-prompt-v3-k2-syndicalia-v5')?.id).toBe('k2-syndicalia');
    expect(modeFromConfigLabel('keywords-prompt-v4-k2-syndicalia-v5')?.version).toBe(5);
    expect(modeFromConfigLabel('slots-prompt-v1-k2-syndicalia-v2')?.version).toBe(2);
  });
});

describe('the corpus after the migration', () => {
  const FOOTAGE = path.join(REPO_ROOT, 'my files', 'test videos');

  it('gives a client to every plan whose analysis has run, and none to the rest', async () => {
    for (const [reel, expected] of [
      ['ground truth', null],
      ['test 1', 'k2-syndicalia'],
      ['test 2', 'k2-syndicalia'],
      ['test 3', null],
      ['vitasilk', 'k2-syndicalia'],
    ] as const) {
      const plan = await readEditPlan(path.join(FOOTAGE, `${reel}.editplan.json`));
      expect(plan.clientMode?.id ?? null, reel).toBe(expected);
      // Null exactly where there is no label to read it from.
      expect(plan.clientMode === null, reel).toBe(plan.pipeline.analysis.config === null);
    }
  });
});
