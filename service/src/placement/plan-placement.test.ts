import { mkdtemp, readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '@framopia/core';
import { createEditPlan, readEditPlan, writeEditPlan } from '../editplan/io.js';
import type { EditPlan, ImageSlot, Zone } from '../editplan/types.js';
import { BOTTOM_EXCLUSION, MIN_PLACED_SHORT_EDGE } from './constants.js';
import { writePlacementsToPlan } from './plan-placement.js';

const NOW = '2026-08-26T00:00:00.000Z';
const LATER = '2026-08-26T01:00:00.000Z';

const TOP: Zone = {
  id: 'z_top_1',
  kind: 'top',
  rect: { x: 0.03, y: 0, w: 0.94, h: 0.3 },
  valid: [[0, 25]],
  manual: false,
};

const WORD = {
  id: 'w0000',
  start: 0,
  end: 25,
  text: 'x',
  sourceText: 'x',
  lang: 'darija',
  script: 'latin',
  confidence: null,
  removed: false,
  removedReason: null,
  edited: false,
};

function slot(id: string, start: number, end: number): ImageSlot {
  return {
    id,
    wordIds: [WORD.id],
    start,
    end,
    contextText: '',
    idea: '',
    prompt: '',
    negativePrompt: '',
    candidates: [],
    chosenCandidateId: null,
    presentation: 'card',
    zoneId: null,
    templateId: null,
    status: 'generated',
  } as unknown as ImageSlot;
}

async function tempPlan(mutate: (p: EditPlan) => void): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'framopia-place-'));
  const file = path.join(dir, 'x.editplan.json');
  const plan = createEditPlan({
    source: {
      videoPath: '/tmp/x.mov',
      sha256: 'a'.repeat(64),
      durationS: 25,
      fps: 29.97,
      width: 2160,
      height: 3840,
      audioPath: '/tmp/x.wav',
    },
    appVersion: '0.1.0',
    now: NOW,
    id: 'plan-1',
  });
  plan.transcript = { words: [WORD] } as unknown as EditPlan['transcript'];
  mutate(plan);
  await writeEditPlan(file, plan);
  return file;
}

describe('writePlacementsToPlan', () => {
  it('changes only meta, pipeline and images', async () => {
    const file = await tempPlan((p) => {
      p.zones = { sampleFps: 2, zones: [TOP] };
      p.images = { slots: [slot('img001', 1, 3)] };
    });
    const before = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
    const result = await writePlacementsToPlan(file, LATER);
    const after = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;

    expect(result.changedTopLevelKeys.sort()).toEqual(['images', 'meta', 'pipeline']);
    for (const key of Object.keys(before)) {
      if (['meta', 'pipeline', 'images'].includes(key)) continue;
      expect(JSON.stringify(after[key])).toBe(JSON.stringify(before[key]));
    }
  });

  it('writes position, scale and zoneId and nothing else on the slot', async () => {
    const file = await tempPlan((p) => {
      p.zones = { sampleFps: 2, zones: [TOP] };
      p.images = { slots: [slot('img001', 1, 3)] };
    });
    const before = (JSON.parse(await readFile(file, 'utf8')) as EditPlan).images.slots[0]!;
    await writePlacementsToPlan(file, LATER);
    const after = (await readEditPlan(file)).images.slots[0]!;

    const changed = Object.keys(before).filter(
      (k) =>
        JSON.stringify((before as unknown as Record<string, unknown>)[k]) !==
        JSON.stringify((after as unknown as Record<string, unknown>)[k]),
    );
    expect(changed).toEqual(['zoneId']);
    expect(after.position).toBeTruthy();
    expect(after.scale).toBeGreaterThan(0);
  });

  // The schema fragility rule: a plan written before the solver existed has
  // neither field, and absent must mean "not placed" rather than the origin.
  it('opens a plan whose slots carry no position or scale', async () => {
    const file = await tempPlan((p) => {
      p.zones = { sampleFps: 2, zones: [TOP] };
      p.images = { slots: [slot('img001', 1, 3)] };
    });
    const reopened = await readEditPlan(file);
    expect(reopened.images.slots[0]?.position).toBeUndefined();
    expect(reopened.images.slots[0]?.scale).toBeUndefined();
  });

  it('leaves the plan untouched when a slot cannot be placed', async () => {
    const file = await tempPlan((p) => {
      p.zones = { sampleFps: 2, zones: [{ ...TOP, valid: [[0, 2]] }] };
      p.images = { slots: [slot('img001', 1, 3)] };
    });
    const before = await readFile(file, 'utf8');
    await expect(writePlacementsToPlan(file, LATER)).rejects.toThrow(/cannot be placed/);
    expect(await readFile(file, 'utf8')).toBe(before);
  });
});

describe('the constants mirrored from the sidecar', () => {
  // tools/cv/framopia_cv/zones.py is the authority for the zone constants.
  // Two copies of a number drift; this fails when they do.
  const source = readFileSync(
    path.join(REPO_ROOT, 'tools', 'cv', 'framopia_cv', 'zones.py'),
    'utf8',
  );

  const pythonValue = (name: string): number => {
    const match = new RegExp(`^${name}\\s*=\\s*([0-9.]+)`, 'm').exec(source);
    if (!match?.[1]) throw new Error(`${name} not found in zones.py; the mirror cannot be checked`);
    return Number(match[1]);
  };

  it('BOTTOM_EXCLUSION matches zones.py', () => {
    expect(BOTTOM_EXCLUSION).toBe(pythonValue('BOTTOM_EXCLUSION'));
  });

  it('MIN_PLACED_SHORT_EDGE matches MIN_ZONE_SHORT_EDGE in zones.py', () => {
    expect(MIN_PLACED_SHORT_EDGE).toBe(pythonValue('MIN_ZONE_SHORT_EDGE'));
  });
});
