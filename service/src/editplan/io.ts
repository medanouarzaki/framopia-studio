import { readFile, writeFile } from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import {
  EDIT_PLAN_SCHEMA_VERSION,
  PIPELINE_STAGES,
  type EditPlan,
  type Pipeline,
  type PipelineStage,
  type PlanSource,
} from './types.js';
import { assertValidEditPlan, EditPlanVersionError } from './validate.js';

export function editPlanPathFor(videoPath: string): string {
  const ext = path.extname(videoPath);
  return path.join(path.dirname(videoPath), `${path.basename(videoPath, ext)}.editplan.json`);
}

function emptyStage(): PipelineStage {
  return { status: 'pending', config: null, costUsd: null, cached: null, completedAt: null, error: null };
}

function emptyPipeline(): Pipeline {
  return Object.fromEntries(PIPELINE_STAGES.map((name) => [name, emptyStage()])) as Pipeline;
}

export interface CreateEditPlanOptions {
  source: PlanSource;
  appVersion: string;
  now: string;
  id?: string;
}

/** A plan with every container present and empty. Later stages fill them. */
export function createEditPlan(options: CreateEditPlanOptions): EditPlan {
  const { source, appVersion, now, id = crypto.randomUUID() } = options;
  return {
    schemaVersion: EDIT_PLAN_SCHEMA_VERSION,
    meta: { id, createdAt: now, updatedAt: now, appVersion },
    source,
    clientMode: null,
    pipeline: emptyPipeline(),
    transcript: { words: [] },
    subtitles: { groups: [] },
    keywords: { mode: 'auto', items: [] },
    images: { slots: [] },
    zones: { sampleFps: 2, zones: [] },
    sfx: { events: [] },
    watermark: null,
    costs: { totalUsd: 0, byStage: {} },
    build: { status: 'none', aepPath: null, builtAt: null },
  };
}

export async function readEditPlan(planPath: string): Promise<EditPlan> {
  const raw = await readFile(planPath, 'utf8');
  const parsed: unknown = JSON.parse(raw);
  const version = (parsed as { schemaVersion?: unknown } | null)?.schemaVersion;
  // Checked before structural validation so an unreadable version reports as
  // a version problem rather than a hundred missing-field issues.
  if (version !== EDIT_PLAN_SCHEMA_VERSION) throw new EditPlanVersionError(version);
  return assertValidEditPlan(parsed);
}

export async function writeEditPlan(planPath: string, plan: EditPlan): Promise<void> {
  assertValidEditPlan(plan);
  await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
}
