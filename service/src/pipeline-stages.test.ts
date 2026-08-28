import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PIPELINE_STAGES, PIPELINE_STAGE_IDS, stageSpec } from './pipeline-stages.js';
import { dryRun } from './dry-run.js';
import { runPipeline, type PipelineStageImpl } from './pipeline.js';

const SRC = path.dirname(fileURLToPath(import.meta.url));

/**
 * The dry run says what a run would do; the runner does it. A user who reads
 * "about $0.18" and then watches differently-named stages go past has been told
 * two stories, so guidelines §3's rule applies: one declaration, pinned by a
 * test rather than by a comment.
 */
describe('the dry run and the runner', () => {
  it('report the same stages, in the same order', async () => {
    const plan = await dryRun('vitasilk', 'k2-syndicalia');
    expect(plan.stages.map((s) => s.id)).toEqual([...PIPELINE_STAGE_IDS]);

    const progress = await runPipeline({
      reel: 'vitasilk',
      modeId: 'k2-syndicalia',
      stages: { zones: vi.fn(async () => ({ skipped: 'already on the plan' })) },
    });
    expect(progress.stages.map((s) => s.id)).toEqual([...PIPELINE_STAGE_IDS]);
  });

  it('use the same words for each stage', async () => {
    const plan = await dryRun('vitasilk', 'k2-syndicalia');
    const progress = await runPipeline({
      reel: 'vitasilk',
      modeId: 'k2-syndicalia',
      stages: { zones: vi.fn(async () => ({ skipped: 'already on the plan' })) },
    });
    expect(progress.stages.map((s) => s.label)).toEqual(plan.stages.map((s) => s.label));
  });

  /*
   * The decisive one. A stage the dry run prices at nothing must not bill, and
   * a stage it prices must be one the runner can actually spend on.
   */
  it('agree on which stages can bill', async () => {
    const plan = await dryRun('vitasilk', 'k2-syndicalia');
    for (const stage of plan.stages) {
      const priced = stage.estimateUsd !== null && stage.estimateUsd > 0;
      if (priced) expect(stageSpec(stage.id as never).billable, stage.id).toBe(true);
    }
    // And the free stage is declared free on both sides.
    expect(stageSpec('zones').billable).toBe(false);
    expect(plan.stages.find((s) => s.id === 'zones')?.estimateUsd).toBeNull();
  });

  it('agree on which stages a run of vitasilk would bill for', async () => {
    const plan = await dryRun('vitasilk', 'k2-syndicalia');
    const wouldBill = new Set(
      plan.stages.filter((s) => s.estimateUsd !== null && s.estimateUsd > 0).map((s) => s.id),
    );

    const asked: string[] = [];
    const record =
      (id: string) =>
      async (): Promise<never> => {
        asked.push(id);
        throw new Error(`${id} should not have been asked for`);
      };
    const stages: Partial<PipelineStageImpl> = {
      transcribe: record('transcription') as unknown as PipelineStageImpl['transcribe'],
      keywords: record('analysis') as unknown as PipelineStageImpl['keywords'],
      slots: record('analysis') as unknown as PipelineStageImpl['slots'],
      images: record('images') as unknown as PipelineStageImpl['images'],
      zones: vi.fn(async () => ({ skipped: 'already on the plan' })),
    };

    const progress = await runPipeline({ reel: 'vitasilk', modeId: 'k2-syndicalia', stages });
    const ran = new Set(progress.stages.filter((s) => s.state === 'done').map((s) => s.id));

    // vitasilk is fully cached, so neither side expects a bill and no stage
    // function was reached at all.
    expect(wouldBill.size).toBe(0);
    expect(ran.size).toBe(0);
    expect(asked).toEqual([]);
  });

  /* One declaration, not two: neither file may carry its own label table. */
  it('take their labels from one declaration', () => {
    const dry = readFileSync(path.join(SRC, 'dry-run.ts'), 'utf8');
    const runner = readFileSync(path.join(SRC, 'pipeline.ts'), 'utf8');
    expect(dry).toContain('PIPELINE_STAGES');
    expect(runner).toContain('PIPELINE_STAGES');
    for (const spec of PIPELINE_STAGES) {
      expect(dry, `dry-run.ts spells out "${spec.label}"`).not.toContain(`'${spec.label}'`);
      expect(runner, `pipeline.ts spells out "${spec.label}"`).not.toContain(`'${spec.label}'`);
    }
  });

  /* The runner must never be the thing that bills. */
  it('leaves every ledger append to the stage that spends', () => {
    const runner = readFileSync(path.join(SRC, 'pipeline.ts'), 'utf8');
    expect(runner).not.toContain('appendCost');
  });
});

/**
 * The six tests above pinned two service functions against each other: same
 * ids, same order, same labels, same billable set. **Every one passed while the
 * panel showed "to run" for a stage the runner skipped**, because none of them
 * looked at what a stage *will do* — the panel inferred that from `provenance`
 * and `estimateUsd`, and those two cannot express "the plan already has it".
 *
 * So the service now says it, and this pins the service half. The rendered half
 * is pinned in `panel/src/render.browser.test.ts`, against the built bundle,
 * which is where the divergence actually reached the user.
 */
describe('what a run will do with each stage', () => {
  it('is stated by the dry run rather than inferred from cost and cache', async () => {
    const plan = await dryRun('vitasilk', 'k2-syndicalia');
    for (const stage of plan.stages) {
      expect(['skip', 'reuse', 'run'], stage.id).toContain(stage.action);
    }
  });

  it('marks a stage the plan already carries as skipped, whatever its cache says', async () => {
    const plan = await dryRun('vitasilk', 'k2-syndicalia');
    const analysis = plan.stages.find((s) => s.id === 'analysis');
    // The keyword entry misses at the active analysis prompt version, so the
    // cache says "would bill" and the plan says "already done". This is the
    // exact pair that disagreed on screen.
    expect(analysis?.provenance).toBe('none');
    expect(analysis?.action).toBe('skip');
    expect(analysis?.estimateUsd).toBeNull();
  });

  it('agrees with the runner, stage for stage, on what happens to vitasilk', async () => {
    const plan = await dryRun('vitasilk', 'k2-syndicalia');
    const progress = await runPipeline({
      reel: 'vitasilk',
      modeId: 'k2-syndicalia',
      stages: { zones: vi.fn(async () => ({ skipped: 'already on the plan' })) },
    });

    for (const predicted of plan.stages) {
      const actual = progress.stages.find((s) => s.id === predicted.id);
      const ranOrSkipped = actual?.state === 'skipped' ? 'skip' : 'ran';
      const expected = predicted.action === 'skip' ? 'skip' : 'ran';
      expect(ranOrSkipped, `${predicted.id}: dry run said "${predicted.action}"`).toBe(expected);
    }
  });
});
