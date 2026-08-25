import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  COSTS_PATH,
  GEMINI_IMAGE_MODEL_FLASH,
  GEMINI_IMAGE_MODEL_PRO,
  REPO_ROOT,
  loadMode,
} from '@framopia/core';
import { readEditPlan } from '../editplan/io.js';
import { GeminiImageClient } from './gemini-client.js';
import { parseImageConfig } from './config.js';
import { estimateRun, formatEstimate } from './estimate.js';
import { generateImages, type GeneratedCandidate } from './generate.js';

/**
 * The Block 4 session 2 model bake-off. One slot, one prompt, two models,
 * three candidates each, and the model is the only variable.
 *
 * `--first-only` generates a single flash candidate and stops, so a parsing
 * defect costs one image instead of six.
 */
const PLAN_PATH = path.join(REPO_ROOT, 'my files', 'test videos', 'vitasilk.editplan.json');
const OUT_DIR = path.join(REPO_ROOT, 'benchmarks', 'results', 'latest-imagebakeoff');
const SLOT_INDEX = 1;
const RESOLUTION = '2K' as const;
const ASPECT_RATIO = '1:1' as const;

const firstOnly = process.argv.includes('--first-only');

function ledgerLines(): number {
  try {
    return readFileSync(COSTS_PATH, 'utf8').split('\n').filter(Boolean).length;
  } catch {
    return 0;
  }
}

const plan = await readEditPlan(PLAN_PATH);
const slot = plan.images.slots[SLOT_INDEX];
if (slot === undefined) {
  throw new Error(`${PLAN_PATH} has no slot at index ${SLOT_INDEX}`);
}
const mode = loadMode('k2-syndicalia');

console.log(`slot ${slot.id}  ${slot.start}s-${slot.end}s`);
console.log(`prompt:\n${slot.prompt}\n`);
console.log(`negativePrompt:\n${slot.negativePrompt}\n`);

const arms = firstOnly
  ? [{ modelId: GEMINI_IMAGE_MODEL_FLASH, take: 1 }]
  : [
      { modelId: GEMINI_IMAGE_MODEL_FLASH, take: 3 },
      { modelId: GEMINI_IMAGE_MODEL_PRO, take: 3 },
    ];

mkdirSync(OUT_DIR, { recursive: true });
const all: GeneratedCandidate[] = [];

for (const arm of arms) {
  const config = parseImageConfig({
    modelId: arm.modelId,
    resolution: RESOLUTION,
    aspectRatio: ASPECT_RATIO,
    candidatesPerSlot: arm.take < 2 ? 2 : arm.take,
    ceilingUsd: 1.0,
  });
  console.log(formatEstimate(estimateRun(1, config)));

  const before = ledgerLines();
  const result = await generateImages({
    slots: [slot],
    mode,
    config,
    client: new GeminiImageClient(),
    videoSha256: plan.source.sha256,
    bill: true,
    log: (m) => console.log(m),
    limit: arm.take,
  });
  const written = ledgerLines() - before;

  for (const c of result.candidates) {
    // The extension follows what the model actually returned. Flash returned
    // image/jpeg for a request that assumed PNG, and writing jpeg bytes into
    // a .png name hands session 3 a mislabelled corpus.
    const ext = path.extname(c.path);
    const dest = path.join(OUT_DIR, `${c.modelId}-${c.candidateIndex + 1}${ext}`);
    writeFileSync(dest, readFileSync(c.path));
  }

  console.log(`\n--- ${arm.modelId} ---`);
  console.log(`ledger lines written: ${written} (expected ${result.candidates.filter((c) => !c.cached).length})`);
  for (const c of result.candidates) {
    console.log(
      `  ${c.id} idx=${c.candidateIndex} cached=${c.cached} ` +
        `actual=$${c.costUsd.toFixed(6)} est=$${c.estimatedUsd.toFixed(4)} ` +
        `bytes=${c.bytes} mime=${c.mimeType} wall=${c.wallTimeS.toFixed(1)}s`,
    );
    console.log(`    text: ${c.text === null ? '(none)' : JSON.stringify(c.text)}`);
  }
  for (const w of result.warnings) console.log(`  warning: ${w}`);
  all.push(...result.candidates);
}

writeFileSync(
  path.join(OUT_DIR, 'candidates.json'),
  `${JSON.stringify({ slotId: slot.id, prompt: slot.prompt, negativePrompt: slot.negativePrompt, candidates: all }, null, 2)}\n`,
  'utf8',
);
console.log(`\nwrote ${all.length} candidates to ${OUT_DIR}`);
