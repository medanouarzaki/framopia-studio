import { loadMode } from '@framopia/core';
import { readEditPlan, writeEditPlan } from '../editplan/io.js';
import { recomposeSlotPrompts } from './recompose.js';

/**
 * Re-composes an existing plan's image prompts against the current mode.
 * **No Gemini call and no analysis re-run**: only the mode's own fragments
 * and the stored ideas are read.
 */
function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const planPath = flag('plan');
if (planPath === undefined) {
  console.error('usage: npm run recompose -- --plan <path.editplan.json> [--mode <id>]');
  process.exit(1);
}

const mode = loadMode(flag('mode') ?? 'k2-syndicalia');
const plan = await readEditPlan(planPath);
const result = recomposeSlotPrompts(plan, mode);

console.log(`${planPath}`);
console.log(`mode ${mode.id} v${mode.version}, ${result.slots.length} slots, ` +
  `${result.changedCount} changed\n`);

for (const r of result.recomposed) {
  console.log(`--- ${r.id} ${r.changed ? '(changed)' : '(unchanged)'} ---`);
  console.log(`before: ${r.promptBefore}`);
  console.log(`after:  ${r.promptAfter}`);
  if (r.negativeBefore !== r.negativeAfter) {
    console.log(`negative before: ${r.negativeBefore}`);
    console.log(`negative after:  ${r.negativeAfter}`);
  }
  console.log();
}

plan.images = { slots: result.slots };
plan.meta.updatedAt = new Date().toISOString();
// writeEditPlan validates first, so a recomposition that broke the schema
// cannot reach disk.
await writeEditPlan(planPath, plan);
console.log(`written: ${planPath}`);
