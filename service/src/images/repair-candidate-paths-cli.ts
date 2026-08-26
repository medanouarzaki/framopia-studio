import { existsSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';
import { readEditPlan, writeEditPlan } from '../editplan/io.js';
import { CACHE_ROOT, cacheEntryDir } from '../transcription/cache.js';
import { DEFAULT_IMAGE_CONFIG } from './config.js';
import { imageFingerprintOf } from './fingerprint.js';
import { IMAGE_CACHE_STAGE, imageFileName } from './cache.js';

/**
 * Repoints a plan's candidate paths at the cache entries they describe.
 *
 * Block 7 session 1 re-keyed every image cache entry onto the new fingerprint
 * by renaming its directory, and did not update the plans that name those
 * directories. **No image was lost** — every file is still on disk under its
 * new key — but each plan's `candidates[].path` points at a directory that no
 * longer exists, which a build reads as a missing candidate.
 *
 * The new key is recomputed from the slot's own prompt and the frozen config,
 * the same inputs `generateImages` would use, so this repairs by derivation
 * rather than by guessing. A candidate whose recomputed entry is not on disk is
 * left exactly as it is and reported.
 *
 * Free and local: no model call, no image generated.
 */
const FOOTAGE_DIR = path.join(REPO_ROOT, 'my files', 'test videos');

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');

let repaired = 0;
let alreadyGood = 0;
let unresolved = 0;

for (const file of readdirSync(FOOTAGE_DIR).filter((f) => f.endsWith('.editplan.json')).sort()) {
  const reel = file.replace('.editplan.json', '');
  const planPath = path.join(FOOTAGE_DIR, file);
  const plan = await readEditPlan(planPath);
  if (plan.images.slots.every((s) => s.candidates.length === 0)) continue;

  let changed = 0;
  for (const slot of plan.images.slots) {
    for (const c of slot.candidates) {
      if (existsSync(c.path)) {
        alreadyGood += 1;
        continue;
      }
      const fingerprint = imageFingerprintOf({
        prompt: slot.prompt,
        negativePrompt: slot.negativePrompt,
        modelId: c.modelId ?? DEFAULT_IMAGE_CONFIG.modelId,
        resolution: (c.resolution ?? DEFAULT_IMAGE_CONFIG.resolution) as typeof DEFAULT_IMAGE_CONFIG.resolution,
        aspectRatio: DEFAULT_IMAGE_CONFIG.aspectRatio,
        candidateIndex: slot.candidates.indexOf(c),
        modeId:
          typeof plan.clientMode === 'string' ? plan.clientMode : (plan.clientMode?.id ?? 'k2-syndicalia'),
      });
      const dir = cacheEntryDir(plan.source.sha256, IMAGE_CACHE_STAGE, fingerprint, CACHE_ROOT);
      const jpg = path.join(dir, imageFileName('image/jpeg'));
      const png = path.join(dir, imageFileName('image/png'));
      const found = existsSync(jpg) ? jpg : existsSync(png) ? png : null;
      if (found === null) {
        console.log(`  UNRESOLVED ${reel} ${c.id}: no entry at ${path.basename(dir)}`);
        unresolved += 1;
        continue;
      }
      console.log(`  ${reel} ${c.id}: ${path.basename(path.dirname(c.path))} -> ${path.basename(dir)}`);
      c.path = found;
      repaired += 1;
      changed += 1;
    }
  }

  if (apply && changed > 0) {
    plan.meta.updatedAt = new Date().toISOString();
    await writeEditPlan(planPath, plan);
    const reread = await readEditPlan(planPath);
    const live = reread.images.slots.flatMap((s) => s.candidates).filter((c) => existsSync(c.path)).length;
    const total = reread.images.slots.flatMap((s) => s.candidates).length;
    console.log(`  ${reel}: written and reopened, ${live}/${total} candidate files present`);
  }
}

console.log(
  `\n${alreadyGood} already correct, ${repaired} repaired, ${unresolved} unresolved. ` +
    '$0.00 — no image was generated and none was deleted.',
);
if (!apply) console.log('dry run — pass --apply to write');
