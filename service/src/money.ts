import { existsSync, readFileSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  BEFORE_THIS_WAS_RECORDED,
  COSTS_PATH,
  LOCAL_DIR,
  byClient,
  byDay,
  byMonth,
  byPurpose,
  byStage,
  byVideo,
  readLedger,
  sumUsd,
  unattributed,
  type Group,
  type LedgerLine,
} from '@framopia/core';

/**
 * **What the money screen is shown, and the only place the ledger is opened.**
 *
 * `core/src/ledger-read.ts` does the reading and cannot open a file at all — it
 * is handed text. This is where the text comes from, and it is read and never
 * written: nothing in this module writes to `COSTS_PATH`, and a test holds it to
 * that. Block 11 session 65 found a test billing a fabricated charge into the
 * real ledger on a machine whose ledger did not exist yet, where it stayed.
 */
export interface MoneyView {
  totalUsd: number;
  lines: number;
  unreadable: number;
  firstAt: string | null;
  lastAt: string | null;
  byDay: Group[];
  byMonth: Group[];
  byStage: Group[];
  byClient: Group[];
  byVideo: Group[];
  byPurpose: Group[];
  /** What no client or video can be put against. Shown, never omitted. */
  unattributedUsd: number;
  credit: CreditView | null;
  perReel: ReelCost[];
  cap: CapView;
}

export interface ReelCost {
  reel: string;
  spentUsd: number;
  durationS: number | null;
  usdPerSecond: number | null;
  /** Which stages actually billed, so a partial run is not read as a whole one. */
  stages: string[];
}

/**
 * **What he entered, when, and what has been spent since — never a balance.**
 *
 * Block 10 session 46 found the $6.82 and $2.71 quoted in earlier reports were
 * Mohamed's own Google balance read off a billing page, and that carrying one
 * forward by subtracting ledger spend gave $2.91 against the $2.71 a later report
 * carried — a $0.20 gap the repository could not explain. So the tool never
 * presents a computed balance as a reading. It shows his figure, its date, and
 * the arithmetic, and says which is which.
 */
export interface CreditView {
  enteredUsd: number;
  enteredAt: string;
  spentSinceUsd: number;
  /** His figure minus what the ledger records since. Arithmetic, not a reading. */
  impliedRemainingUsd: number;
}

export interface CapView {
  /** Null means no cap: the default, until he sets one. */
  monthlyUsd: number | null;
  monthSoFarUsd: number;
}

const CREDIT_PATH = path.join(LOCAL_DIR, 'credit.json');
const CAP_PATH = path.join(LOCAL_DIR, 'cap.json');

/** The ledger, read. Absent is empty, which is what a fresh machine has. */
function ledgerText(costsPath: string): string {
  return existsSync(costsPath) ? readFileSync(costsPath, 'utf8') : '';
}

export function readCredit(): { usd: number; at: string } | null {
  if (!existsSync(CREDIT_PATH)) return null;
  try {
    const parsed = JSON.parse(readFileSync(CREDIT_PATH, 'utf8')) as Record<string, unknown>;
    const usd = parsed['usd'];
    const at = parsed['at'];
    if (typeof usd !== 'number' || !Number.isFinite(usd) || typeof at !== 'string') return null;
    return { usd, at };
  } catch {
    return null;
  }
}

/**
 * His figure and the moment he read it. **Written to its own file, never to the
 * ledger** — a credit balance is not a payment and has no business in an
 * append-only record of what was spent.
 */
export function setCredit(usd: number, at = new Date().toISOString()): void {
  if (!Number.isFinite(usd) || usd < 0) throw new Error('a credit figure is a number, not less than zero');
  mkdirSync(path.dirname(CREDIT_PATH), { recursive: true });
  writeFileSync(CREDIT_PATH, `${JSON.stringify({ usd, at }, null, 2)}\n`, 'utf8');
}

export function readCap(): number | null {
  if (!existsSync(CAP_PATH)) return null;
  try {
    const parsed = JSON.parse(readFileSync(CAP_PATH, 'utf8')) as Record<string, unknown>;
    const usd = parsed['monthlyUsd'];
    return typeof usd === 'number' && Number.isFinite(usd) && usd > 0 ? usd : null;
  } catch {
    return null;
  }
}

export function setCap(monthlyUsd: number | null): void {
  mkdirSync(path.dirname(CAP_PATH), { recursive: true });
  writeFileSync(CAP_PATH, `${JSON.stringify({ monthlyUsd }, null, 2)}\n`, 'utf8');
}

/**
 * **A plan for a video the operating system owns is nobody's work.**
 *
 * Mohamed opened the money screen and found nine reels from the test suite in
 * his books — *"a video this tool has never seen"*, *"a video whose client has
 * no pictures at all"*. They are there because the suites write real Edit Plans
 * into `.local/plans/`, which is also where a client's plans live.
 *
 * **Decided by what the video is, not by what it is called.** Every one of those
 * plans names a video inside the OS temporary directory — a place the operating
 * system owns and deletes, where nothing anybody paid for lives. A client's
 * footage is in their folder or on the drive; it is never there. So the name
 * plays no part, and a reel called *"a video this tool has never seen"* whose
 * footage sits somewhere real is listed like any other.
 *
 * **Spend is not the test.** Four of the nine carry a figure — $0.000488 and
 * $0.000244 — written by the suites, so "no spend" would have hidden one of nine
 * and left eight. And a real reel can legitimately have spent nothing yet.
 *
 * **What this gives up, said plainly:** a video someone genuinely kept in the
 * temporary directory would not be listed. A folder the operating system deletes
 * without warning is not somewhere a person keeps work they paid for, so that is
 * the right way round — but it is a limit and not an absence of one.
 */
export function isOsTemporary(videoPath: string): boolean {
  if (videoPath === '') return false;
  /*
   * The **directory** is resolved, not the file. On macOS `tmpdir()` is
   * `/var/folders/…`, which is a symlink to `/private/var/folders/…`, and a
   * video the tests have already cleaned up cannot be resolved at all — so
   * resolving the file gave `/var/…` against a `/private/var/…` root and every
   * comparison failed. Walking up to the nearest directory that does exist
   * resolves the symlink whether or not the file is still there.
   */
  const real = (p: string): string => {
    let at = path.resolve(p);
    const parts: string[] = [];
    for (;;) {
      try {
        return path.join(realpathSync(at), ...parts.reverse());
      } catch {
        const up = path.dirname(at);
        if (up === at) return path.resolve(p);
        parts.push(path.basename(at));
        at = up;
      }
    }
  };
  const temp = real(tmpdir());
  const rel = path.relative(temp, real(videoPath));
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/** Every reel's spend, from its own plan. The plan is the only thing that knows. */
export function reelCosts(planPaths: readonly string[]): ReelCost[] {
  const out: ReelCost[] = [];
  for (const p of planPaths) {
    if (!existsSync(p)) continue;
    let plan: Record<string, unknown>;
    try {
      plan = JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>;
    } catch {
      continue;
    }
    const costs = (plan['costs'] ?? {}) as Record<string, unknown>;
    const spent = costs['spentUsd'];
    if (typeof spent !== 'number') continue;
    const source = (plan['source'] ?? {}) as Record<string, unknown>;
    const videoPath = typeof source['videoPath'] === 'string' ? source['videoPath'] : '';
    if (isOsTemporary(videoPath)) continue;
    const durationS = typeof source['durationS'] === 'number' ? source['durationS'] : null;
    out.push({
      reel: path.basename(p).replace(/\.editplan\.json$/, ''),
      spentUsd: spent,
      durationS,
      usdPerSecond: durationS !== null && durationS > 0 ? spent / durationS : null,
      stages: Object.entries((costs['spentByStage'] ?? {}) as Record<string, number>)
        .filter(([, v]) => v > 0)
        .map(([k]) => k)
        .sort(),
    });
  }
  return out.sort((a, b) => b.spentUsd - a.spentUsd);
}

export function moneyView(options: {
  costsPath?: string;
  planPaths?: readonly string[];
  now?: Date;
}): MoneyView {
  const costsPath = options.costsPath ?? COSTS_PATH;
  const read = readLedger(ledgerText(costsPath));
  const now = options.now ?? new Date();
  const month = now.toISOString().slice(0, 7);

  const credit = readCredit();
  const monthSoFar = sumUsd(
    read.lines.filter((l) => l.timestamp.slice(0, 7) === month).map((l) => l.usd),
  );

  return {
    totalUsd: read.totalUsd,
    lines: read.lines.length,
    unreadable: read.unreadable.length,
    firstAt: read.firstAt,
    lastAt: read.lastAt,
    byDay: byDay(read.lines),
    byMonth: byMonth(read.lines),
    byStage: byStage(read.lines),
    byClient: byClient(read.lines),
    byVideo: byVideo(read.lines),
    byPurpose: byPurpose(read.lines),
    unattributedUsd: unattributed(byClient(read.lines))?.usd ?? 0,
    credit:
      credit === null
        ? null
        : {
            enteredUsd: credit.usd,
            enteredAt: credit.at,
            spentSinceUsd: spentSince(read.lines, credit.at),
            impliedRemainingUsd:
              Math.round((credit.usd - spentSince(read.lines, credit.at)) * 1_000_000) /
              1_000_000,
          },
    perReel: reelCosts(options.planPaths ?? []),
    cap: { monthlyUsd: readCap(), monthSoFarUsd: monthSoFar },
  };
}

function spentSince(lines: readonly LedgerLine[], at: string): number {
  return sumUsd(lines.filter((l) => l.timestamp > at).map((l) => l.usd));
}

export { BEFORE_THIS_WAS_RECORDED };
