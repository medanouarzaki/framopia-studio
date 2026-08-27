/**
 * The alignment review sheet: `npm run align:review -- --reel vitasilk`.
 *
 * An instrument, not a pipeline stage, which is why it lives in tools/ rather
 * than service/. It runs the current aligner over the cached Scribe draft and
 * the cached corrected words, and emits the pairing it produced for a human to
 * judge. It decides nothing.
 *
 * Read-only by construction: it opens the cache and writes only into
 * benchmarks/results/latest-align-review/. It cannot spend money — it imports
 * the aligner through `@framopia/core/align-review`, whose graph is `align`
 * and `normalizeToken` and nothing else, deliberately not the `@framopia/core`
 * barrel, which re-exports `appendCost`. A test in core pins that.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildAlignmentRows, renderSheet, type AlignmentRow } from '@framopia/core/align-review';
import { ACTIVE_PROMPT_VERSION, CacheEntrySelectionError } from '@framopia/core/cache-select';
import {
  argValue,
  describeEntry,
  loadEntry,
  headSha,
  OUT_DIR,
  reelLabels,
  ReviewError,
  videoShaFor,
} from './load.js';

/** Deliberate opt-out from the pinned entry, for reproducing a historical figure. */
const entryFlag = argValue('--entry');

function main(): void {
  const reel = argValue('--reel');
  if (reel === null) throw new ReviewError(`--reel is required; one of ${reelLabels()}`);

  const entry = loadEntry(videoShaFor(reel), reel, entryFlag);
  const rows: AlignmentRow[] = buildAlignmentRows(entry.draft, entry.correctedTexts);

  const generatedAt = new Date().toISOString();
  const sha = headSha();

  mkdirSync(OUT_DIR, { recursive: true });
  const pairsPath = path.join(OUT_DIR, `${reel}.pairs.json`);
  writeFileSync(
    pairsPath,
    `${JSON.stringify(
      {
        reel,
        generatedAt,
        headSha: sha,
        cacheEntry: entry.name,
        promptVersion: entry.promptVersion,
        pinnedPromptVersion: ACTIVE_PROMPT_VERSION,
        draftTokens: entry.draft.length,
        rows,
      },
      null,
      2,
    )}\n`,
  );

  const htmlPath = path.join(OUT_DIR, `${reel}.html`);
  writeFileSync(
    htmlPath,
    renderSheet({
      reel,
      headSha: sha,
      generatedAt,
      cacheEntry: entry.name,
      promptVersion: entry.promptVersion,
      rows,
    }),
  );

  const cross = rows.filter((r) => r.crossScript).length;
  const unanchored = rows.filter((r) => r.draftIndex === null).length;
  console.log(
    `${reel}: ${rows.length} corrected words against ${entry.draft.length} draft tokens ` +
      `from ${describeEntry(entry)}` +
      (entryFlag === null ? '' : ' [--entry override]'),
  );
  console.log(`  ${cross} cross-script pairings, ${unanchored} words with no draft token`);
  console.log(`  ${pairsPath}`);
  console.log(`  ${htmlPath}`);
}

try {
  main();
} catch (error) {
  if (error instanceof ReviewError || error instanceof CacheEntrySelectionError) {
    console.error(`align:review: ${error.message}`);
    process.exit(1);
  }
  throw error;
}
