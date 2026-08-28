import { readdirSync } from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT,
  loadMode,
  loadSfxIndex,
  loadTemplateManifest,
  templatesById,
} from '@framopia/core';
import { readEditPlan, writeEditPlan } from '../editplan/io.js';
import type { SfxEvent } from '../editplan/types.js';
import { assignTemplates } from './assign.js';
import { deriveSfxEvents } from './sfx.js';
import { templateImpacts } from './template-impacts.js';

/**
 * Assigns template ids to every element on every existing plan and re-derives
 * SFX from the current manifest.
 *
 * Both steps are pure and deterministic (Block 3 decision 10's seeded shuffle,
 * then ARCHITECTURE §3's rule that events are recomputed, never hand-authored)
 * so **this cannot bill**. It exists because the stage that used to own
 * assignment has not run since the manifest became real, leaving keywords with
 * no template and the stored events carrying gains from the stub era.
 *
 * Dry-run by default.
 */
const FOOTAGE_DIR = path.join(REPO_ROOT, 'my files', 'test videos');

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const modeIndex = argv.indexOf('--mode');
const modeId = modeIndex === -1 ? 'k2-syndicalia' : (argv[modeIndex + 1] as string);

const mode = loadMode(modeId);
const templates = templatesById(loadTemplateManifest());
const sfxIndex = loadSfxIndex();

const key = (e: SfxEvent): string => `${e.sourceElementId}|${e.sfxId}`;
const show = (e: SfxEvent): string =>
  `${e.sfxId}@${e.timeS.toFixed(3)}s ${e.gainDb}dB from ${e.sourceElementId}`;

for (const file of readdirSync(FOOTAGE_DIR).filter((f) => f.endsWith('.editplan.json')).sort()) {
  const reel = file.replace('.editplan.json', '');
  const planPath = path.join(FOOTAGE_DIR, file);
  const plan = await readEditPlan(planPath);

  const before = plan.sfx.events;
  const keywordsBefore = plan.keywords.items.filter((k) => k.templateId !== null).length;

  const assignment = assignTemplates(plan, mode, templates);
  const after = deriveSfxEvents(plan, templates, sfxIndex, templateImpacts());
  const keywordsAfter = plan.keywords.items.filter((k) => k.templateId !== null).length;

  console.log(
    `\n== ${reel}: keywords with a template ${keywordsBefore} -> ${keywordsAfter}; ` +
      `sfx events ${before.length} -> ${after.length}`,
  );
  for (const issue of assignment.issues) console.log(`   issue ${issue.path}: ${issue.message}`);
  console.log(`   keyword templates: ${assignment.assigned.keyword.join(', ') || 'none'}`);

  const beforeKeys = new Map(before.map((e) => [key(e), e]));
  const afterKeys = new Map(after.map((e) => [key(e), e]));
  for (const [k, e] of afterKeys) {
    const was = beforeKeys.get(k);
    if (was === undefined) console.log(`   NEW     ${show(e)}`);
    else if (was.gainDb !== e.gainDb || Math.abs(was.timeS - e.timeS) > 1e-9) {
      console.log(`   CHANGED ${show(was)}  ->  ${show(e)}`);
    }
  }
  for (const [k, e] of beforeKeys) {
    if (!afterKeys.has(k)) console.log(`   DROPPED ${show(e)}`);
  }

  if (apply) {
    plan.sfx = { events: after };
    plan.meta.updatedAt = new Date().toISOString();
    await writeEditPlan(planPath, plan);
    const reread = await readEditPlan(planPath);
    console.log(
      `   written and reopened: ${reread.sfx.events.length} events, ` +
        `${reread.keywords.items.filter((k) => k.templateId !== null).length} keywords templated`,
    );
  }
}

console.log('\n$0.00 — assignment and derivation are pure local computation.');
if (!apply) console.log('dry run — pass --apply to write');
