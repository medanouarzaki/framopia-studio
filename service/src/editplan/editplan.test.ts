import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createEditPlan,
  editPlanPathFor,
  readEditPlan,
  validateEditPlan,
  writeEditPlan,
  EditPlanValidationError,
  EditPlanVersionError,
  type EditPlan,
  type PlanSource,
} from './index.js';

const source: PlanSource = {
  videoPath: '/videos/vitasilk.mov',
  sha256: 'a'.repeat(64),
  durationS: 25.692333,
  fps: 29.97,
  width: 2160,
  height: 3840,
  audioPath: '/local/audio/vitasilk.wav',
};

function minimalPlan(): EditPlan {
  return createEditPlan({
    source,
    appVersion: '0.1.0',
    now: '2026-08-25T00:00:00.000Z',
    id: 'plan-1',
  });
}

describe('createEditPlan', () => {
  it('produces a plan that validates with every container present and empty', () => {
    const plan = minimalPlan();
    expect(validateEditPlan(plan)).toEqual([]);
    expect(plan.transcript.words).toEqual([]);
    expect(plan.subtitles.groups).toEqual([]);
    expect(plan.keywords.items).toEqual([]);
    expect(plan.images.slots).toEqual([]);
    expect(plan.zones.zones).toEqual([]);
    expect(plan.sfx.events).toEqual([]);
  });

  it('sets every pipeline stage to pending', () => {
    const plan = minimalPlan();
    expect(Object.keys(plan.pipeline)).toEqual([
      'transcription',
      'analysis',
      'images',
      'zones',
      'build',
    ]);
    for (const stage of Object.values(plan.pipeline)) {
      expect(stage.status).toBe('pending');
      expect(stage.costUsd).toBeNull();
    }
  });
});

describe('editPlanPathFor', () => {
  it('sits beside the video, named after it', () => {
    expect(editPlanPathFor('/videos/vitasilk.mov')).toBe('/videos/vitasilk.editplan.json');
  });

  it('handles a name containing dots', () => {
    expect(editPlanPathFor('/v/reel.v2.final.mp4')).toBe('/v/reel.v2.final.editplan.json');
  });
});

describe('validateEditPlan — required fields', () => {
  const cases: [string, (plan: Record<string, unknown>) => void][] = [
    ['meta.id', (p) => delete (p.meta as Record<string, unknown>).id],
    ['meta.appVersion', (p) => delete (p.meta as Record<string, unknown>).appVersion],
    ['source.sha256', (p) => delete (p.source as Record<string, unknown>).sha256],
    ['source.durationS', (p) => delete (p.source as Record<string, unknown>).durationS],
    ['source.audioPath', (p) => delete (p.source as Record<string, unknown>).audioPath],
    ['pipeline.transcription', (p) => delete (p.pipeline as Record<string, unknown>).transcription],
    ['transcript.words', (p) => delete (p.transcript as Record<string, unknown>).words],
    ['subtitles.groups', (p) => delete (p.subtitles as Record<string, unknown>).groups],
    ['keywords.mode', (p) => delete (p.keywords as Record<string, unknown>).mode],
    ['zones.sampleFps', (p) => delete (p.zones as Record<string, unknown>).sampleFps],
    ['costs.totalUsd', (p) => delete (p.costs as Record<string, unknown>).totalUsd],
    ['build.status', (p) => delete (p.build as Record<string, unknown>).status],
  ];

  for (const [pathName, breakIt] of cases) {
    it(`names ${pathName} when it is missing`, () => {
      const plan = JSON.parse(JSON.stringify(minimalPlan())) as Record<string, unknown>;
      breakIt(plan);
      const issues = validateEditPlan(plan);
      expect(issues.map((i) => i.path)).toContain(pathName);
    });
  }
});

describe('validateEditPlan — word and group rules', () => {
  function planWithWord(overrides: Record<string, unknown>): EditPlan {
    const plan = minimalPlan();
    plan.transcript.words = [
      {
        id: 'w0001',
        start: 0.1,
        end: 0.4,
        text: 'bzaf',
        sourceText: 'بزاف',
        lang: 'darija',
        script: 'latin',
        confidence: 0.9,
        removed: false,
        removedReason: null,
        edited: false,
        ...overrides,
      } as EditPlan['transcript']['words'][number],
    ];
    return plan;
  }

  it('accepts a well-formed word', () => {
    expect(validateEditPlan(planWithWord({}))).toEqual([]);
  });

  it('rejects an unknown lang, naming the word index', () => {
    const issues = validateEditPlan(planWithWord({ lang: 'klingon' }));
    expect(issues.map((i) => i.path)).toContain('transcript.words[0].lang');
  });

  it('rejects an unknown script', () => {
    const issues = validateEditPlan(planWithWord({ script: 'cyrillic' }));
    expect(issues.map((i) => i.path)).toContain('transcript.words[0].script');
  });

  it('rejects a word that ends before it starts', () => {
    const issues = validateEditPlan(planWithWord({ start: 2, end: 1 }));
    expect(issues.map((i) => i.path)).toContain('transcript.words[0].end');
  });

  it('rejects a removed word with no reason', () => {
    const issues = validateEditPlan(planWithWord({ removed: true, removedReason: null }));
    expect(issues.map((i) => i.path)).toContain('transcript.words[0].removedReason');
  });

  it('accepts a removed word that says why', () => {
    expect(validateEditPlan(planWithWord({ removed: true, removedReason: 'filler' }))).toEqual([]);
  });

  it('rejects a group referencing a word that does not exist', () => {
    const plan = planWithWord({});
    plan.subtitles.groups = [
      { id: 'g001', wordIds: ['w0001', 'w9999'], start: 0.1, end: 0.4, templateId: null },
    ];
    const issues = validateEditPlan(plan);
    expect(issues.map((i) => i.path)).toContain('subtitles.groups[0].wordIds[1]');
  });

  it('accepts a group whose word ids all exist', () => {
    const plan = planWithWord({});
    plan.subtitles.groups = [
      { id: 'g001', wordIds: ['w0001'], start: 0.1, end: 0.4, templateId: null },
    ];
    expect(validateEditPlan(plan)).toEqual([]);
  });
});

describe('edit plan io', () => {
  let dir: string;
  let planPath: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'framopia-editplan-'));
    planPath = path.join(dir, 'reel.editplan.json');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('round-trips a plan without changing its content', async () => {
    const plan = minimalPlan();
    plan.transcript.words = [
      {
        id: 'w0001',
        start: 0.099,
        end: 0.46,
        text: '5',
        sourceText: 'خمس',
        lang: 'darija',
        script: 'latin',
        confidence: 0.8187307530779818,
        removed: false,
        removedReason: null,
        edited: false,
      },
    ];
    plan.costs = { totalUsd: 0.077188, byStage: { transcription: 0.077188 } };

    await writeEditPlan(planPath, plan);
    const readBack = await readEditPlan(planPath);
    expect(readBack).toEqual(plan);
    // Exact, not merely deep-equal: no float or key-order drift on disk.
    expect(readFileSync(planPath, 'utf8')).toBe(`${JSON.stringify(plan, null, 2)}\n`);
  });

  it('refuses to write a plan that does not validate', async () => {
    const plan = minimalPlan();
    (plan.meta as { id: unknown }).id = 42;
    await expect(writeEditPlan(planPath, plan)).rejects.toBeInstanceOf(EditPlanValidationError);
  });

  it('fails loudly on a newer schema version', async () => {
    const plan = { ...minimalPlan(), schemaVersion: 2 };
    writeFileSync(planPath, JSON.stringify(plan));
    await expect(readEditPlan(planPath)).rejects.toBeInstanceOf(EditPlanVersionError);
  });

  it('fails loudly on a missing schema version', async () => {
    const plan = minimalPlan() as Partial<EditPlan>;
    delete plan.schemaVersion;
    writeFileSync(planPath, JSON.stringify(plan));
    await expect(readEditPlan(planPath)).rejects.toBeInstanceOf(EditPlanVersionError);
  });

  it('reports the offending path when a stored plan is structurally wrong', async () => {
    const plan = minimalPlan() as unknown as Record<string, unknown>;
    (plan.zones as Record<string, unknown>).sampleFps = 'two';
    writeFileSync(planPath, JSON.stringify(plan));
    await expect(readEditPlan(planPath)).rejects.toThrow(/zones\.sampleFps/);
  });
});

describe('validateEditPlan — image candidates (Block 4 fields)', () => {
  function planWithCandidate(candidate: Record<string, unknown>): EditPlan {
    const plan = minimalPlan();
    plan.transcript.words = [
      {
        id: 'w1', start: 0, end: 0.4, text: 'kolajin', sourceText: 'kolajin',
        lang: 'darija', script: 'latin', confidence: 0.9,
        removed: false, removedReason: null, edited: false,
      },
    ];
    plan.images.slots = [
      {
        id: 's001', wordIds: ['w1'], start: 0, end: 2,
        contextText: 'ctx', idea: 'idea', prompt: 'p', negativePrompt: 'n',
        candidates: [candidate as never],
        chosenCandidateId: null, presentation: null,
        zoneId: null, templateId: null, status: 'pending',
      },
    ];
    return plan;
  }

  const schemaV1 = { id: 'c1', path: '/i.png', cutoutPath: null, cutoutQuality: null };

  /**
   * The schema-fragility rule: readEditPlan validates on read, so a required
   * addition would make every pre-Block-4 plan unopenable, migration
   * included. A candidate carrying only the v1 fields has to stay legal.
   */
  it('accepts a candidate with none of the Block 4 fields', () => {
    expect(validateEditPlan(planWithCandidate(schemaV1))).toEqual([]);
  });

  it('accepts a candidate carrying all of them', () => {
    expect(
      validateEditPlan(
        planWithCandidate({
          ...schemaV1,
          modelId: 'gemini-3.1-flash-image',
          resolution: '2K',
          generatedAt: '2026-08-25T00:00:00.000Z',
          costUsd: 0.101,
          promptFingerprint: '0123456789abcdef',
          metrics: { alphaEdgeNoise: 0.1, holeRatio: 0, foregroundArea: 0.4, edgeHalo: 0.02 },
        }),
      ),
    ).toEqual([]);
  });

  it('accepts null metrics, which is a gate that has not run', () => {
    expect(validateEditPlan(planWithCandidate({ ...schemaV1, metrics: null }))).toEqual([]);
  });

  it('rejects a 4K candidate: the comps scale those pixels away', () => {
    const issues = validateEditPlan(planWithCandidate({ ...schemaV1, resolution: '4K' }));
    expect(issues.map((i) => i.path)).toEqual(['images.slots[0].candidates[0].resolution']);
  });

  it('rejects a present-but-wrongly-typed Block 4 field', () => {
    const issues = validateEditPlan(planWithCandidate({ ...schemaV1, costUsd: 'free' }));
    expect(issues.map((i) => i.path)).toEqual(['images.slots[0].candidates[0].costUsd']);
  });

  it('still requires the v1 candidate fields', () => {
    const issues = validateEditPlan(planWithCandidate({ id: 'c1' }));
    expect(issues.map((i) => i.path)).toContain('images.slots[0].candidates[0].path');
  });

  it('reports an incomplete metrics object per field', () => {
    const issues = validateEditPlan(
      planWithCandidate({ ...schemaV1, metrics: { alphaEdgeNoise: 0.1 } }),
    );
    expect(issues.map((i) => i.path)).toEqual([
      'images.slots[0].candidates[0].metrics.holeRatio',
      'images.slots[0].candidates[0].metrics.foregroundArea',
      'images.slots[0].candidates[0].metrics.edgeHalo',
    ]);
  });
});

describe('validateEditPlan — detected text on a candidate', () => {
  function planWithCandidate(candidate: Record<string, unknown>): EditPlan {
    const plan = minimalPlan();
    plan.transcript.words = [
      {
        id: 'w1', start: 0, end: 0.4, text: 'kolajin', sourceText: 'kolajin',
        lang: 'darija', script: 'latin', confidence: 0.9,
        removed: false, removedReason: null, edited: false,
      },
    ];
    plan.images.slots = [
      {
        id: 's001', wordIds: ['w1'], start: 0, end: 2,
        contextText: 'ctx', idea: 'idea', prompt: 'p', negativePrompt: 'n',
        candidates: [candidate as never],
        chosenCandidateId: null, presentation: null,
        zoneId: null, templateId: null, status: 'pending',
      },
    ];
    return plan;
  }

  const base = { id: 'c1', path: '/i.png', cutoutPath: null, cutoutQuality: null };

  // Absent means the pass has not run, which is not the same as having run
  // and found nothing. Every plan written before Block 4 session 4 is absent.
  it('accepts a candidate with no detectedText', () => {
    expect(validateEditPlan(planWithCandidate(base))).toEqual([]);
  });

  it('accepts an empty array, which is "ran and found nothing"', () => {
    expect(validateEditPlan(planWithCandidate({ ...base, detectedText: [] }))).toEqual([]);
  });

  it('accepts detections', () => {
    expect(
      validateEditPlan(
        planWithCandidate({
          ...base,
          detectedText: [
            { text: 'HAIR', confidence: 0.984 },
            { text: 'SERUM', confidence: 0.958 },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it('rejects a confidence outside 0-1', () => {
    const issues = validateEditPlan(
      planWithCandidate({ ...base, detectedText: [{ text: 'HAIR', confidence: 1.5 }] }),
    );
    expect(issues.map((i) => i.path)).toEqual([
      'images.slots[0].candidates[0].detectedText[0].confidence',
    ]);
  });

  it('rejects a detection missing its text', () => {
    const issues = validateEditPlan(
      planWithCandidate({ ...base, detectedText: [{ confidence: 0.9 }] }),
    );
    expect(issues.map((i) => i.path)).toContain(
      'images.slots[0].candidates[0].detectedText[0].text',
    );
  });
});
