import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { loadTemplateManifest, templatesById } from '@framopia/core';
import { readEditPlan } from './editplan/io.js';
import { checkBuildability } from './analysis/buildability.js';

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { plan: { type: 'string' } } });

  if (!values.plan || !existsSync(values.plan)) {
    console.error('Usage: npm run validate-plan -- --plan <path.editplan.json>');
    process.exitCode = 1;
    return;
  }

  // readEditPlan validates structure; this command answers the separate
  // question of whether the structure describes something buildable.
  const plan = await readEditPlan(values.plan);
  const manifest = loadTemplateManifest();
  const report = checkBuildability(plan, templatesById(manifest));

  const { checked } = report;
  console.log(
    `${checked.subtitleGroups} subtitle group(s), ${checked.keywords} keyword(s), ` +
      `${checked.imageSlots} image slot(s), ${checked.sfxEvents} sfx event(s)`,
  );

  if (report.issues.length === 0) {
    console.log('buildable: no issues');
    return;
  }

  console.error(`buildable: NO — ${report.issues.length} issue(s)`);
  for (const issue of report.issues) {
    const short = issue.shortByS === undefined ? '' : ` (short by ${issue.shortByS.toFixed(2)}s)`;
    console.error(`  ${issue.path}: ${issue.message}${short}`);
  }
  process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
