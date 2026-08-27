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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildAlignmentRows,
  renderSheet,
  type AlignmentRow,
  type DraftToken,
} from '@framopia/core/align-review';
import {
  ACTIVE_PROMPT_VERSION,
  CacheEntrySelectionError,
  describeSelection,
  listTranscriptionEntries,
  selectTranscriptionEntry,
} from '@framopia/core/cache-select';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const FOOTAGE_DIR = path.join(REPO_ROOT, 'my files', 'test videos');
const CACHE_ROOT = path.join(REPO_ROOT, '.local', 'cache');
const OUT_DIR = path.join(REPO_ROOT, 'benchmarks', 'results', 'latest-align-review');

/** Reel label to the plan basename, which is also the video basename. */
const REELS: Record<string, string> = {
  'ground-truth': 'ground truth',
  'test-1': 'test 1',
  'test-2': 'test 2',
  'test-3': 'test 3',
  vitasilk: 'vitasilk',
};

class ReviewError extends Error {}

interface CachedEntry {
  name: string;
  promptVersion: number | null;
  draft: DraftToken[];
  correctedTexts: string[];
}

function argValue(flag: string): string | null {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] !== undefined ? (argv[i + 1] as string) : null;
}

/** Deliberate opt-out from the pinned entry, for reproducing a historical figure. */
const entryFlag = argValue('--entry');

/**
 * The entry at the pinned prompt version, by the shared rule in
 * `@framopia/core/cache-select`. Session 1 took the highest version present,
 * which happened to agree with the pin but was still a rule of its own; the
 * defect record's own figures came from three different entries, and none of
 * them said which.
 */
function loadEntry(videoSha: string, reel: string): CachedEntry {
  const entries = listTranscriptionEntries(CACHE_ROOT, videoSha);
  if (entries.length === 0) {
    throw new ReviewError(`${reel}: no transcription cache entry under ${path.join(CACHE_ROOT, videoSha)}`);
  }
  const chosen = selectTranscriptionEntry(entries, reel, { entryOverride: entryFlag });

  const manifest = JSON.parse(
    readFileSync(path.join(chosen.dir, 'manifest.json'), 'utf8'),
  ) as Record<string, unknown>;
  const scribeRaw = manifest['scribeRaw'] as { words?: unknown } | undefined;
  const words = Array.isArray(scribeRaw?.words) ? scribeRaw.words : null;
  if (words === null) throw new ReviewError(`${chosen.id}/manifest.json holds no scribeRaw.words`);
  if (manifest['correctionRaw'] === undefined) {
    throw new ReviewError(`${chosen.id}/manifest.json holds no correctionRaw`);
  }
  const correctedTexts = manifest['correctedTexts'];
  if (!Array.isArray(correctedTexts)) {
    throw new ReviewError(`${chosen.id}/manifest.json holds no correctedTexts`);
  }
  const draft = (words as { text: string; start: number; end: number; type: string }[])
    .filter((w) => w.type === 'word')
    .map(({ text, start, end }) => ({ text, start, end }));

  return {
    name: chosen.id,
    promptVersion: chosen.promptVersion,
    draft,
    correctedTexts: correctedTexts as string[],
  };
}

function headSha(): string {
  const gitDir = path.join(REPO_ROOT, '.git');
  try {
    const head = readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
    if (!head.startsWith('ref:')) return head;
    const ref = head.slice(4).trim();
    const loose = path.join(gitDir, ref);
    if (existsSync(loose)) return readFileSync(loose, 'utf8').trim();
    const packed = readFileSync(path.join(gitDir, 'packed-refs'), 'utf8');
    for (const line of packed.split('\n')) {
      const [sha, name] = line.split(' ');
      if (name === ref && sha !== undefined) return sha;
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

function main(): void {
  const reel = argValue('--reel');
  if (reel === null) {
    throw new ReviewError(`--reel is required; one of ${Object.keys(REELS).sort().join(', ')}`);
  }
  const basename = REELS[reel];
  if (basename === undefined) {
    throw new ReviewError(`unknown reel "${reel}"; one of ${Object.keys(REELS).sort().join(', ')}`);
  }

  const planPath = path.join(FOOTAGE_DIR, `${basename}.editplan.json`);
  if (!existsSync(planPath)) {
    throw new ReviewError(`no edit plan at ${planPath}; the video sha comes from it`);
  }
  const plan = JSON.parse(readFileSync(planPath, 'utf8')) as { source: { sha256: string } };

  const entry = loadEntry(plan.source.sha256, reel);
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
      `from ${describeSelection({ id: entry.name, dir: '', promptVersion: entry.promptVersion })}` +
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
