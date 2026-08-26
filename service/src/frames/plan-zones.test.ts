import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createEditPlan, readEditPlan, writeEditPlan } from '../editplan/io.js';
import type { EditPlan, Zone } from '../editplan/types.js';
import {
  ManualZoneError,
  clearManualZone,
  mergeZones,
  setManualZone,
  writeZonesToPlan,
} from './plan-zones.js';

const NOW = '2026-08-26T00:00:00.000Z';
const LATER = '2026-08-26T01:00:00.000Z';

function auto(id: string, kind: Zone['kind'], w = 0.3, h = 0.4): Zone {
  return { id, kind, rect: { x: 0, y: 0, w, h }, valid: [[0, 10]], manual: false };
}

function plan(): EditPlan {
  return createEditPlan({
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
}

async function tempPlan(mutate: (p: EditPlan) => void = () => {}): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'framopia-zones-'));
  const file = path.join(dir, 'x.editplan.json');
  const p = plan();
  mutate(p);
  await writeEditPlan(file, p);
  return file;
}

describe('mergeZones', () => {
  it('replaces the automatic zones', () => {
    const existing = { sampleFps: 2, zones: [auto('z_top_1', 'top')] };
    const merged = mergeZones(existing, [auto('z_left_1', 'left')], 2);
    expect(merged.zones.zones.map((z) => z.id)).toEqual(['z_left_1']);
  });

  // ARCHITECTURE §3: an automated re-run never overwrites a flagged item.
  it('carries a manual zone through untouched and lists it first', () => {
    const manual: Zone = { ...auto('z_manual_1', 'right'), manual: true };
    const existing = { sampleFps: 2, zones: [auto('z_top_1', 'top'), manual] };
    const merged = mergeZones(existing, [auto('z_top_1', 'top', 0.9, 0.1)], 2);
    expect(merged.zones.zones[0]).toBe(manual);
    expect(merged.zones.zones.map((z) => z.id)).toEqual(['z_manual_1', 'z_top_1']);
  });

  // The id is what the panel and the solver refer to, so a computed zone is
  // dropped rather than renamed around a manual one.
  it('drops a computed zone whose id a manual zone already claims', () => {
    const manual: Zone = { ...auto('z_top_1', 'top'), manual: true };
    const merged = mergeZones({ sampleFps: 2, zones: [manual] }, [auto('z_top_1', 'top')], 2);
    expect(merged.droppedForCollision).toEqual(['z_top_1']);
    expect(merged.zones.zones).toEqual([manual]);
  });
});

describe('setManualZone and clearManualZone', () => {
  it('forces the manual flag whatever the caller sent', () => {
    const zones = setManualZone({ sampleFps: 2, zones: [] }, auto('z_a', 'top'));
    expect(zones.zones[0]?.manual).toBe(true);
  });

  it('refuses a rect that leaves the frame', () => {
    expect(() =>
      setManualZone({ sampleFps: 2, zones: [] }, {
        ...auto('z_a', 'right'),
        rect: { x: 0.9, y: 0, w: 0.4, h: 0.2 },
      }),
    ).toThrow(ManualZoneError);
  });

  it('refuses to clear a zone that is not manual', () => {
    const zones = { sampleFps: 2, zones: [auto('z_top_1', 'top')] };
    expect(() => clearManualZone(zones, 'z_top_1')).toThrow(/not manual/);
  });

  it('clearing restores automatic behaviour for that id', () => {
    let zones = setManualZone({ sampleFps: 2, zones: [] }, auto('z_top_1', 'top'));
    zones = clearManualZone(zones, 'z_top_1');
    expect(zones.zones).toEqual([]);
    // With nothing manual left, the recomputation's own zone is kept.
    const merged = mergeZones(zones, [auto('z_top_1', 'top', 0.9, 0.1)], 2);
    expect(merged.droppedForCollision).toEqual([]);
    expect(merged.zones.zones[0]?.rect.w).toBe(0.9);
  });
});

describe('writeZonesToPlan', () => {
  it('changes only meta, pipeline and zones', async () => {
    const file = await tempPlan();
    const before = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
    const result = await writeZonesToPlan(file, [auto('z_top_1', 'top')], 2, LATER);
    const after = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;

    expect(result.changedTopLevelKeys.sort()).toEqual(['meta', 'pipeline', 'zones']);
    for (const key of Object.keys(before)) {
      if (['meta', 'pipeline', 'zones'].includes(key)) continue;
      expect(JSON.stringify(after[key])).toBe(JSON.stringify(before[key]));
    }
  });

  it('keeps a manual zone byte-identical across a recomputation', async () => {
    const manual: Zone = {
      id: 'z_manual_hero',
      kind: 'right',
      rect: { x: 0.62, y: 0.3, w: 0.34, h: 0.2 },
      valid: [[3, 12]],
      manual: true,
    };
    const file = await tempPlan((p) => {
      p.zones = { sampleFps: 2, zones: [auto('z_top_1', 'top'), manual] };
    });

    const result = await writeZonesToPlan(file, [auto('z_top_1', 'top', 0.5, 0.5)], 2, NOW);
    const reopened = await readEditPlan(file);
    const survivor = reopened.zones.zones.find((z) => z.id === 'z_manual_hero');

    expect(result.manualKept).toBe(1);
    expect(JSON.stringify(survivor)).toBe(JSON.stringify(manual));
    // and the automatic zone around it was refreshed
    expect(reopened.zones.zones.find((z) => z.id === 'z_top_1')?.rect.w).toBe(0.5);
  });

  it('marks the zones pipeline stage done at no cost', async () => {
    const file = await tempPlan();
    await writeZonesToPlan(file, [auto('z_top_1', 'top')], 2, NOW);
    const reopened = await readEditPlan(file);
    expect(reopened.pipeline.zones).toMatchObject({ status: 'done', costUsd: 0, cached: false });
  });
});

describe('the schema addition', () => {
  // The absolute constraint: readEditPlan validates on read, so a required
  // addition would make every plan written before it unopenable, including
  // for migration.
  it('opens a plan written before any zone item existed', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'framopia-old-'));
    const file = path.join(dir, 'old.editplan.json');
    const old = plan();
    old.zones = { sampleFps: 2, zones: [] };
    await writeFile(file, `${JSON.stringify(old, null, 2)}\n`, 'utf8');

    const reopened = await readEditPlan(file);
    expect(reopened.zones.zones).toEqual([]);
  });

  it('rejects a zone whose rect leaves the frame', async () => {
    const file = await tempPlan();
    await expect(
      writeZonesToPlan(
        file,
        [{ ...auto('z_a', 'right'), rect: { x: 0.9, y: 0, w: 0.4, h: 0.2 } }],
        2,
        NOW,
      ),
    ).rejects.toThrow(/extends past the frame/);
  });

  it('rejects duplicate zone ids', async () => {
    const file = await tempPlan();
    await expect(
      writeZonesToPlan(file, [auto('z_a', 'top'), auto('z_a', 'left')], 2, NOW),
    ).rejects.toThrow(/duplicate zone id/);
  });
});

describe('the torso kind widening', () => {
  const torso: Zone = {
    id: 'z_manual_torso',
    kind: 'torso',
    rect: { x: 0.28, y: 0.46, w: 0.44, h: 0.2 },
    valid: [[2, 20]],
    manual: true,
  };

  // A widening of the kind enum cannot be optional-with-default the way a new
  // field can, so what is proven here is that a plan carrying the new value
  // round-trips and one carrying only the old values still opens.
  it('accepts a torso zone through the validator', async () => {
    const file = await tempPlan((p) => {
      p.zones = { sampleFps: 2, zones: [torso] };
    });
    const reopened = await readEditPlan(file);
    expect(reopened.zones.zones[0]?.kind).toBe('torso');
  });

  it('still opens a plan whose zones are all pre-widening kinds', async () => {
    const file = await tempPlan((p) => {
      p.zones = { sampleFps: 2, zones: [auto('z_top_1', 'top'), auto('z_left_1', 'left')] };
    });
    const reopened = await readEditPlan(file);
    expect(reopened.zones.zones.map((z) => z.kind)).toEqual(['top', 'left']);
  });

  it('keeps a manual torso zone byte-identical across a recomputation', async () => {
    const file = await tempPlan((p) => {
      p.zones = { sampleFps: 2, zones: [auto('z_top_1', 'top'), torso] };
    });
    await writeZonesToPlan(file, [auto('z_top_1', 'top', 0.5, 0.5)], 2, NOW);
    const reopened = await readEditPlan(file);
    const survivor = reopened.zones.zones.find((z) => z.id === 'z_manual_torso');
    expect(JSON.stringify(survivor)).toBe(JSON.stringify(torso));
  });

  it('accepts a torso zone as a manual override', () => {
    const zones = setManualZone({ sampleFps: 2, zones: [] }, { ...torso, manual: false });
    expect(zones.zones[0]?.kind).toBe('torso');
    expect(zones.zones[0]?.manual).toBe(true);
  });
});
