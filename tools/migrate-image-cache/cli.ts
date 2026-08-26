/**
 * Re-keys existing image cache entries onto the Block 7 fingerprint, which
 * dropped `modeVersion` (see service/src/images/fingerprint.ts).
 *
 * Without it the 14 entries on disk — $2.064064 of billed API spend — would
 * miss forever and regenerate. Nothing is regenerated and nothing is billed:
 * the entry is renamed, its bytes untouched.
 *
 * The migration is only safe because an entry's own manifest records every
 * fingerprint input except `aspectRatio`, and that one is *recovered rather
 * than assumed*: the old key is recomputed from the manifest plus a candidate
 * ratio and must reproduce the directory name exactly. An entry whose old key
 * does not reproduce is left alone and reported, never renamed on a guess.
 *
 * One-shot by nature. It is committed because a migration that ran once and
 * left no record is indistinguishable from a cache that was silently wiped.
 */
import { existsSync, readdirSync, renameSync, statSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { CACHE_ROOT } from '../../service/src/transcription/cache.js';
import { ALLOWED_ASPECT_RATIOS } from '../../service/src/images/config.js';
import { imageFingerprintOf } from '../../service/src/images/fingerprint.js';
import type { ImageResolution } from '@framopia/core';

const STAGE_PREFIX = 'images-';

interface StoredManifest {
  prompt: string;
  negativePrompt: string;
  modelId: string;
  resolution: string;
  candidateIndex: number;
  modeId: string;
  modeVersion: number;
  costUsd: number;
}

/** The pre-Block-7 key, reproduced so the recovered aspect ratio is proven. */
function legacyFingerprint(m: StoredManifest, aspectRatio: string): string {
  const canonical = JSON.stringify([
    m.prompt,
    m.negativePrompt,
    m.modelId,
    m.resolution,
    aspectRatio,
    m.candidateIndex,
    m.modeId,
    m.modeVersion,
  ]);
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

interface Row {
  videoSha: string;
  oldKey: string;
  newKey: string | null;
  aspectRatio: string | null;
  costUsd: number;
  note: string;
}

function scan(root: string): Row[] {
  const rows: Row[] = [];
  if (!existsSync(root)) return rows;
  for (const videoSha of readdirSync(root).sort()) {
    const videoDir = path.join(root, videoSha);
    if (!statSync(videoDir).isDirectory()) continue;
    for (const entry of readdirSync(videoDir).sort()) {
      if (!entry.startsWith(STAGE_PREFIX)) continue;
      const oldKey = entry.slice(STAGE_PREFIX.length);
      const manifestPath = path.join(videoDir, entry, 'manifest.json');
      if (!existsSync(manifestPath)) {
        rows.push({ videoSha, oldKey, newKey: null, aspectRatio: null, costUsd: 0,
          note: 'no manifest' });
        continue;
      }
      const m = JSON.parse(readFileSync(manifestPath, 'utf8')) as StoredManifest;
      const recovered = ALLOWED_ASPECT_RATIOS.find(
        (r) => legacyFingerprint(m, r) === oldKey,
      );
      if (!recovered) {
        rows.push({ videoSha, oldKey, newKey: null, aspectRatio: null,
          costUsd: m.costUsd ?? 0, note: 'old key does not reproduce from its manifest' });
        continue;
      }
      const newKey = imageFingerprintOf({
        prompt: m.prompt,
        negativePrompt: m.negativePrompt,
        modelId: m.modelId,
        resolution: m.resolution as ImageResolution,
        aspectRatio: recovered,
        candidateIndex: m.candidateIndex,
        modeId: m.modeId,
      });
      rows.push({ videoSha, oldKey, newKey, aspectRatio: recovered,
        costUsd: m.costUsd ?? 0, note: newKey === oldKey ? 'already migrated' : 'ok' });
    }
  }
  return rows;
}

function main(): void {
  const apply = process.argv.includes('--apply');
  const root = CACHE_ROOT;
  const rows = scan(root);

  console.log(`image cache root: ${root}`);
  console.log(`entries found: ${rows.length}\n`);
  for (const r of rows) {
    const to = r.newKey ? `${STAGE_PREFIX}${r.newKey}` : '(unmigratable)';
    console.log(
      `${r.videoSha.slice(0, 12)}  ${STAGE_PREFIX}${r.oldKey} -> ${to}` +
        `  aspect=${r.aspectRatio ?? '?'}  $${r.costUsd.toFixed(6)}  ${r.note}`,
    );
  }

  const failed = rows.filter((r) => r.newKey === null);
  const movable = rows.filter((r) => r.newKey !== null && r.newKey !== r.oldKey);
  const value = rows.reduce((sum, r) => sum + r.costUsd, 0);
  console.log(
    `\n${movable.length} to re-key, ${failed.length} unmigratable, ` +
      `$${value.toFixed(6)} of billed spend on disk`,
  );

  if (failed.length > 0) {
    console.error('\nrefusing to migrate: an entry cannot be re-keyed from what it stores');
    process.exit(1);
  }
  if (!apply) {
    console.log('\ndry run — pass --apply to rename');
    return;
  }

  for (const r of movable) {
    const from = path.join(root, r.videoSha, `${STAGE_PREFIX}${r.oldKey}`);
    const to = path.join(root, r.videoSha, `${STAGE_PREFIX}${r.newKey}`);
    if (existsSync(to)) {
      console.error(`refusing to overwrite existing entry ${to}`);
      process.exit(1);
    }
    renameSync(from, to);
    console.log(`renamed ${r.oldKey} -> ${r.newKey}`);
  }
  console.log(`\n${movable.length} entries re-keyed, 0 images regenerated, $0.00 billed`);
}

main();
