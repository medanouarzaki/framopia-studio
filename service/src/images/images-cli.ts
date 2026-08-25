import { COSTS_PATH, readCosts } from '@framopia/core';
import { generateImagesForPlan } from './job.js';
import { IMAGE_LEDGER_STAGE } from './estimate.js';

/**
 * The image stage over one plan. **Billable.**
 *
 * The session's spend baseline is taken once, here, and passed down, so every
 * arm of the run shares one ceiling — Block 4 session 3 gave each arm its own
 * and went $0.33 over.
 */
function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const planPath = flag('plan');
if (planPath === undefined) {
  console.error(
    'usage: npm run images -- --plan <abs path.editplan.json> [--mode <id>] ' +
      '[--ceiling <usd>] [--no-cache] [--force]',
  );
  process.exit(1);
}

const baseline = readCosts()[IMAGE_LEDGER_STAGE] ?? 0;
const ceiling = flag('ceiling');
const probe = process.argv.includes('--probe');

const result = await generateImagesForPlan({
  planPath,
  modeId: flag('mode') ?? 'k2-syndicalia',
  force: process.argv.includes('--force'),
  useCache: !process.argv.includes('--no-cache'),
  spendBaselineUsd: baseline,
  ceilingUsd: ceiling === undefined ? undefined : Number(ceiling),
  limit: probe ? 1 : undefined,
  log: (m) => console.log(m),
});

if (probe) {
  for (const c of result.generated) {
    console.log(
      `\nPROBE ${c.id}\n` +
        `  model      ${c.modelId}\n` +
        `  dimensions ${c.width ?? '?'}x${c.height ?? '?'}\n` +
        `  mime       ${c.mimeType}\n` +
        `  bytes      ${c.bytes}\n` +
        `  wall       ${c.wallTimeS.toFixed(1)}s\n` +
        `  estimate   $${c.estimatedUsd.toFixed(6)} published\n` +
        `  actual     $${c.costUsd.toFixed(6)}\n` +
        `  cached     ${c.cached}\n` +
        `  text       ${c.text === null ? '(none)' : JSON.stringify(c.text)}`,
    );
  }
  console.log(
    `\nbilled ${result.billedImages}, this run $${result.totalUsd.toFixed(6)}. ` +
      'Plan not written: a probe covers one candidate.',
  );
  process.exit(0);
}

console.log();
for (const slot of result.plan.images.slots) {
  console.log(`${slot.id}  presentation=${slot.presentation ?? 'null (candidates disagree)'}  status=${slot.status}`);
  for (const c of slot.candidates) {
    const v = c.textVerdict;
    const text =
      v === null || v === undefined
        ? 'text ?'
        : v.unexpected.length > 0
          ? `TEXT UNEXPECTED ${v.unexpected.join(',')}`
          : v.hasText
            ? `text ok (${v.expected.join(',')})`
            : 'no text';
    console.log(
      `  ${c.id}  ${c.gate?.presentation}  quality=${(c.cutoutQuality ?? 0).toFixed(3)}  ` +
        `$${(c.costUsd ?? 0).toFixed(6)}  ${text}`,
    );
  }
}
console.log();
console.log(
  `billed ${result.billedImages}, cached ${result.cachedImages}, ` +
    `this run $${result.totalUsd.toFixed(6)}`,
);
console.log(`ledger now $${(readCosts(COSTS_PATH)[IMAGE_LEDGER_STAGE] ?? 0).toFixed(6)} for images`);
