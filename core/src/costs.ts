import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { LOCAL_DIR, REPO_ROOT } from './paths.js';

/**
 * **Where the money went, as well as how much.**
 *
 * Block 12 session 68 read the 165 lines the ledger already held and found they
 * answer *how much*, *when*, *which stage* and *which model* — and nothing else.
 * **No line says which client it was for or which video.** Session 46 produced a
 * per-reel table by reconstructing it from `.local/cache/`, which is keyed on
 * the video's sha256; session 68 measured that the same reconstruction now
 * recovers only **54.9%** of the total, because the caches keep a fixed number
 * of entries per video and evict the oldest. **That share falls every time
 * anything is spent.** The three fields below are what stops it falling further.
 *
 * **Optional, and absent means unknown rather than zero.** The 165 lines already
 * on disk are an append-only record of real money and are never rewritten,
 * reformatted or migrated. A reader shows a line without these as *before this
 * was recorded* — never guessed at, and never attributed to a client by
 * inference from a timestamp.
 */
export interface CostEntry {
  stage: string;
  model: string;
  unit: string;
  usd: number;
  /** The client's mode id, when the spend was for one. */
  client?: string;
  /** The video's sha256, which is what `.local/cache/` is already keyed on. */
  video?: string;
  /**
   * Whether this was building the tool or doing a client's work.
   *
   * **Derived, never set by hand** — see `spendPurposeFor`. A figure a person
   * types is a figure a person can be wrong about, and this one decides how the
   * agency reads its own costs.
   */
  purpose?: SpendPurpose;
  // Set only on corrections to an earlier, wrong entry: the ledger is
  // append-only, so a correction is a delta line that names what it fixes.
  note?: string;
}

export type SpendPurpose = 'building' | 'client-work';

/**
 * **Building or client work, decided by which video the money was spent on.**
 *
 * The five reels in `benchmarks/footage.json` are the corpus this tool was built
 * and proved against — they are the agency's own footage, used as fixtures, and
 * nothing spent on them is billable to anyone. Any other video is a client's.
 * Spend with no video at all is a benchmark or a prompt experiment, which is
 * building by definition: session 68 measured $4.502282 of exactly that in the
 * existing lines.
 *
 * **The catalogue is the one source**, the same file the doctor checks the
 * footage against, so a reel added to or removed from the corpus changes this
 * answer without anyone remembering to.
 */
export function spendPurposeFor(videoSha256: string | null | undefined): SpendPurpose {
  if (typeof videoSha256 !== 'string' || videoSha256.length === 0) return 'building';
  return corpusSha256s().has(videoSha256) ? 'building' : 'client-work';
}

let corpusCache: Set<string> | null = null;

function corpusSha256s(): Set<string> {
  if (corpusCache !== null) return corpusCache;
  const file = path.join(REPO_ROOT, 'benchmarks', 'footage.json');
  const out = new Set<string>();
  if (existsSync(file)) {
    try {
      const parsed = JSON.parse(readFileSync(file, 'utf8')) as {
        reels?: { sha256?: unknown }[];
      };
      for (const reel of parsed.reels ?? []) {
        if (typeof reel.sha256 === 'string' && reel.sha256.length > 0) out.add(reel.sha256);
      }
    } catch {
      // An unreadable catalogue must not decide that a client's video was ours.
      // Empty means every video reads as a client's, which is the safer error.
    }
  }
  corpusCache = out;
  return out;
}

interface CostRecord extends CostEntry {
  timestamp: string;
}

export const COSTS_PATH = path.join(LOCAL_DIR, 'costs.jsonl');

export function appendCost(entry: CostEntry, costsPath = COSTS_PATH): void {
  const record: CostRecord = { ...entry, timestamp: new Date().toISOString() };
  mkdirSync(path.dirname(costsPath), { recursive: true });
  appendFileSync(costsPath, `${JSON.stringify(record)}\n`, 'utf8');
}

export function readCosts(costsPath = COSTS_PATH): Record<string, number> {
  if (!existsSync(costsPath)) {
    return {};
  }

  const totals: Record<string, number> = {};
  const lines = readFileSync(costsPath, 'utf8').split('\n').filter(Boolean);
  for (const line of lines) {
    const record = JSON.parse(line) as CostRecord;
    totals[record.stage] = (totals[record.stage] ?? 0) + record.usd;
  }
  return totals;
}
