import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import {
  CacheEntrySelectionError,
  describeSelection,
  listTranscriptionEntries,
  REPO_ROOT,
  selectTranscriptionEntry,
} from '@framopia/core';
import { readEditPlan, writeEditPlan } from '../editplan/io.js';
import { CACHE_ROOT } from './cache.js';

/**
 * Repairs `sourceText` on plans written before the aligner carried it.
 *
 * Free and local: the raw Scribe response and the corrected texts are both in
 * the transcription cache, so the alignment is re-run from recorded data and
 * **nothing is re-transcribed**. A reel whose cache entry is gone is reported
 * and left alone rather than guessed at.
 *
 * Only `sourceText` is touched. Timings, text and every other field are
 * written back exactly as they were.
 */
const FOOTAGE_DIR = path.join(REPO_ROOT, 'my files', 'test videos');

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const entryFlag = argv.includes('--entry') ? (argv[argv.indexOf('--entry') + 1] ?? null) : null;

interface CachedTranscription {
  scribeRaw?: { words?: { text: string; start: number; end: number; type: string; logprob?: number }[] };
  correctedTexts?: string[];
}

/**
 * The entry at the pinned prompt version, never the first one `readdir`
 * happens to return. This took `readdir` order until Block 8 session 2, which
 * on `vitasilk` is the prompt v1 entry — a different set of corrected words
 * from the one the plan was built from.
 */
function cachedFor(
  videoSha: string,
  reel: string,
): { cached: CachedTranscription; entry: string } {
  const entries = listTranscriptionEntries(CACHE_ROOT, videoSha);
  const chosen = selectTranscriptionEntry(entries, reel, { entryOverride: entryFlag });
  return {
    cached: JSON.parse(readFileSync(path.join(chosen.dir, 'manifest.json'), 'utf8')) as CachedTranscription,
    entry: describeSelection(chosen),
  };
}

let repaired = 0;
let alreadyRight = 0;
let unrepairable = 0;

for (const file of readdirSync(FOOTAGE_DIR).filter((f) => f.endsWith('.editplan.json')).sort()) {
  const reel = file.replace('.editplan.json', '');
  const planPath = path.join(FOOTAGE_DIR, file);
  const plan = await readEditPlan(planPath);

  let selected: { cached: CachedTranscription; entry: string };
  try {
    selected = cachedFor(plan.source.sha256, reel);
  } catch (error) {
    if (!(error instanceof CacheEntrySelectionError)) throw error;
    console.log(`${reel.padEnd(14)} ${error.message}`);
    unrepairable += plan.transcript.words.length;
    continue;
  }
  const draftRaw = selected.cached.scribeRaw?.words?.filter((w) => w.type === 'word');
  const corrected = selected.cached.correctedTexts;
  if (!draftRaw || !corrected) {
    console.log(`${reel.padEnd(14)} cache entry holds no draft or corrected words; left as it is`);
    unrepairable += plan.transcript.words.length;
    continue;
  }
  console.log(`${reel.padEnd(14)} reading ${selected.entry}`);
  if (corrected.length !== plan.transcript.words.length) {
    console.log(
      `${reel.padEnd(14)} cache holds ${corrected.length} corrected words against the plan's ` +
        `${plan.transcript.words.length}; left as it is rather than paired by position`,
    );
    unrepairable += plan.transcript.words.length;
    continue;
  }

  /*
   * Paired by the interval the word already carries, not by re-running the
   * aligner. Re-running produced a *different* alignment from the one whose
   * timings are on the plan — same code, but the draft it was given here is
   * rebuilt from the cache rather than being the array the original run used —
   * and a `sourceText` describing one alignment beside timings from another is
   * worse than the off-by-one it replaces. Matching on the interval is exact
   * and self-consistent by construction.
   *
   * A word with no confidence was interpolated, so it has no anchor and keeps
   * its own text, which is what the field's contract says.
   */
  let changed = 0;
  let same = 0;
  const byInterval = new Map<string, string>();
  for (const d of draftRaw) byInterval.set(`${d.start.toFixed(6)}|${d.end.toFixed(6)}`, d.text);

  plan.transcript.words.forEach((w) => {
    const anchored = w.confidence !== null && w.confidence !== undefined;
    const hit = anchored ? byInterval.get(`${w.start.toFixed(6)}|${w.end.toFixed(6)}`) : undefined;
    const want = hit ?? w.text;
    if (w.sourceText === want) same += 1;
    else {
      w.sourceText = want;
      changed += 1;
    }
  });
  repaired += changed;
  alreadyRight += same;
  const unanchored = plan.transcript.words.filter(
    (w) => (w.confidence !== null && w.confidence !== undefined) &&
      !byInterval.has(`${w.start.toFixed(6)}|${w.end.toFixed(6)}`),
  );
  console.log(
    `${reel.padEnd(14)} ${plan.transcript.words.length} words: ${changed} corrected, ${same} already right` +
      (unanchored.length > 0
        ? `; ${unanchored.length} anchored word(s) sit on no draft interval and keep their own text`
        : ''),
  );

  if (apply && changed > 0) {
    plan.meta.updatedAt = new Date().toISOString();
    await writeEditPlan(planPath, plan);
    const reread = await readEditPlan(planPath);
    const good = reread.transcript.words.filter((w) => {
      const anchored = w.confidence !== null && w.confidence !== undefined;
      const hit = anchored ? byInterval.get(`${w.start.toFixed(6)}|${w.end.toFixed(6)}`) : undefined;
      return w.sourceText === (hit ?? w.text);
    }).length;
    console.log(`   written and reopened: ${good}/${reread.transcript.words.length} correct`);
  }
}

console.log(
  `\n${repaired} corrected, ${alreadyRight} already right, ${unrepairable} unrepairable. ` +
    '$0.00 — the alignment is re-run from the cache, nothing is re-transcribed.',
);
if (!apply) console.log('dry run — pass --apply to write');
