import { resolveStoredPath } from '@framopia/core';
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

/**
 * Every absolute path a plan stores, re-rooted onto the repository running now.
 *
 * A plan holds 52 of them across the corpus and every one was written on the
 * drive this project grew up on, which made the whole thing portable only to a
 * machine with a volume of that name. Resolving them **here**, in the one
 * function that opens a plan, is the same shape as `readTranscriptionCache`
 * overwriting a manifest's stored `audioPath` — the reason a relocated cache
 * entry still hits.
 *
 * **The file keeps what it says.** This is a read-time change and no writer was
 * touched, so nothing is migrated and the schema is untouched. A plan that is
 * read, edited and written back does persist the resolved form; that is
 * self-healing rather than a migration, and the resolver reads either form.
 */
function resolvePlanPaths(plan: EditPlan): EditPlan {
  const at = (value: string, field: string): string => resolveStoredPath(value, { field });
  plan.source.videoPath = at(plan.source.videoPath, 'source.videoPath');
  plan.source.audioPath = at(plan.source.audioPath, 'source.audioPath');
  if (plan.clientMode !== null) {
    plan.clientMode.path = at(plan.clientMode.path, 'clientMode.path');
  }
  if (plan.watermark !== null) {
    plan.watermark.assetPath = at(plan.watermark.assetPath, 'watermark.assetPath');
  }
  if (plan.build.aepPath !== null) {
    plan.build.aepPath = at(plan.build.aepPath, 'build.aepPath');
  }
  for (const slot of plan.images.slots) {
    for (const candidate of slot.candidates) {
      candidate.path = at(candidate.path, `${slot.id}/${candidate.id}.path`);
      if (candidate.cutoutPath != null) {
        candidate.cutoutPath = at(candidate.cutoutPath, `${slot.id}/${candidate.id}.cutoutPath`);
      }
    }
  }
  return plan;
}

export async function readEditPlan(planPath: string): Promise<EditPlan> {
  const raw = await readFile(planPath, 'utf8');
  const parsed: unknown = JSON.parse(raw);
  const version = (parsed as { schemaVersion?: unknown } | null)?.schemaVersion;
  // Checked before structural validation so an unreadable version reports as
  // a version problem rather than a hundred missing-field issues.
  if (version !== EDIT_PLAN_SCHEMA_VERSION) throw new EditPlanVersionError(version);
  return resolvePlanPaths(assertValidEditPlan(parsed));
}

export async function writeEditPlan(planPath: string, plan: EditPlan): Promise<void> {
  assertValidEditPlan(plan);
  await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
}
