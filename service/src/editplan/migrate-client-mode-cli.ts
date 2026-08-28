import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { modePathFor, REPO_ROOT } from '@framopia/core';
import { readEditPlan, writeEditPlan } from './io.js';
import { modeFromConfigLabel } from '../analysis/job.js';

/**
 * Free, local, `$0.00` and no API call. Gives existing plans the client mode
 * they were built for.
 *
 * **Derived, never guessed.** The analysis and slot stages have always written
 * a config label naming the mode and its version — `keywords-prompt-v3-
 * k2-syndicalia-v5` — so the answer has been on the plan since the stage ran.
 * `modeFromConfigLabel` is the inverse of the function that wrote it.
 *
 * A plan whose analysis never ran has no label and is **left null**: there is
 * nothing on disk that says which client it belongs to, and a wrong client is
 * worse than an absent one.
 *
 * Only `meta` and `clientMode` may change; the migration asserts it by
 * comparing the file before and after rather than by intending to.
 */
const dir = path.join(REPO_ROOT, 'my files', 'test videos');
const apply = process.argv.includes('--apply');

const WRITABLE_KEYS = new Set(['meta', 'clientMode']);

function assertOnlyChanged(before: string, after: string, planPath: string): void {
  const a = JSON.parse(before) as Record<string, unknown>;
  const b = JSON.parse(after) as Record<string, unknown>;
  const changed = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(
    (k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]),
  );
  const illegal = changed.filter((k) => !WRITABLE_KEYS.has(k));
  if (illegal.length > 0) {
    throw new Error(
      `${planPath}: this migration may only change ${[...WRITABLE_KEYS].join(', ')}, ` +
        `and it changed ${illegal.join(', ')}`,
    );
  }
}

let written = 0;
let unknown = 0;

for (const file of readdirSync(dir).filter((f) => f.endsWith('.editplan.json')).sort()) {
  const planPath = path.join(dir, file);
  const reel = file.replace('.editplan.json', '');
  const plan = await readEditPlan(planPath);

  // Either stage's label answers it; analysis runs first, so it is preferred.
  const derived =
    modeFromConfigLabel(plan.pipeline.analysis.config) ??
    modeFromConfigLabel(plan.pipeline.images.config);

  if (derived === null) {
    unknown += 1;
    console.log(
      `${reel.padEnd(14)} no client determinable — analysis ` +
        `${plan.pipeline.analysis.status}, no config label to read it from`,
    );
    continue;
  }

  const already = plan.clientMode;
  console.log(
    `${reel.padEnd(14)} ${derived.id} v${derived.version} from ` +
      `"${plan.pipeline.analysis.config ?? plan.pipeline.images.config}"` +
      (already === null ? '' : ` (plan already says ${already.id} v${already.version})`),
  );

  if (!apply) continue;
  const before = readFileSync(planPath, 'utf8');
  plan.clientMode = {
    id: derived.id,
    version: derived.version,
    path: modePathFor(derived.id),
  };
  plan.meta.updatedAt = new Date().toISOString();
  await writeEditPlan(planPath, plan);
  assertOnlyChanged(before, readFileSync(planPath, 'utf8'), planPath);
  const reread = await readEditPlan(planPath);
  console.log(
    `    written and reopened: clientMode ${reread.clientMode?.id} v${reread.clientMode?.version}`,
  );
  written += 1;
}

console.log(
  `\n${written} plans given a client, ${unknown} left null. ` +
    '$0.00 — this migration makes no model call.',
);
if (!apply) console.log('dry run — pass --apply to write');
