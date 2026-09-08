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
  paidIn: PaymentsView;
  reconciliation: Reconciliation;
}

/**
 * **What a reel really cost, which is not always what its plan claims.**
 *
 * Both figures are actuals — session 68 established that — and the plan's
 * `spentByStage` genuinely accumulates. But it only ever accumulated what it
 * saw: spend billed before the field existed, or on a plan later replaced, is
 * in the ledger and in no plan. Session 71 measured $5.595868 of exactly that.
 *
 * **The ledger cannot undercount, because it is written at the point of spend.**
 * So where the ledger knows a reel, the greater of the two is what the reel
 * cost, and `basis` says which answered — a figure that silently means two
 * things is worse than either.
 *
 * **The ledger knows a reel only from Block 12 session 68**, which is when a
 * line began carrying the video it was for. All 165 lines written before that
 * carry none, and they are never attributed by the cache, by their timestamp,
 * or by anything else.
 */
export type CostBasis = 'ledger' | 'plan' | 'both';

export interface ReelCost {
  reel: string;
  spentUsd: number;
  durationS: number | null;
  usdPerSecond: number | null;
  /** Which stages actually billed, so a partial run is not read as a whole one. */
  stages: string[];
  /** What the plan claims, kept so the two can be compared on screen. */
  planUsd: number;
  /** What the ledger records against this video. Zero when it knows none. */
  ledgerUsd: number;
  basis: CostBasis;
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

/**
 * **Money that went in, which the ledger never sees.**
 *
 * The ledger is what the tool spent through the APIs. Mohamed also *pays into*
 * those accounts — roughly $23.40 to ElevenLabs and $20 elsewhere — and none of
 * it is anywhere in this repository, so the money screen showed what went out
 * and nothing about what went in.
 *
 * **A payment is not a spend, so it is not a ledger line.** The ledger is
 * append-only evidence of calls this tool made; a payment is a fact about a bank
 * and nothing here can verify it. It lives in `.local/payments.json`, beside
 * `credit.json`, for the same reason: entered by him, about his accounts, and
 * corrigible — which an append-only record is not.
 *
 * **A payment is not credit either.** Credit is what an account has left *today*;
 * a payment is money that went in *on a date*. Two payments add up; two credit
 * readings do not. The screen keeps them in separate blocks with separate words
 * and never adds one to the other.
 */
export interface Payment {
  /** Given by the tool so a correction names one payment and not another. */
  id: string;
  usd: number;
  /** The day the money went in, as he read it: YYYY-MM-DD. */
  on: string;
  /** Which account it went to, in his words. */
  account: string;
}

export interface PaymentsView {
  payments: Payment[];
  totalInUsd: number;
  /** Paid in, minus everything the ledger records. Arithmetic, not a reading. */
  impliedLeftUsd: number;
}

/**
 * **What the ledger says against what the videos account for.**
 *
 * Two sources sat on one screen and were never checked against each other: the
 * grand total is read from the ledger, and the per-video figures from each
 * plan's own `spentUsd`. Session 71 measured the difference at **$10.098150**,
 * of which $4.502282 is benchmarks and prompt experiments that belong to no
 * video by their nature, leaving **$5.594404 of production spend no plan claims**.
 *
 * **A gap in that direction is expected. The other direction is a defect.** The
 * ledger cannot record less than was spent on a reel — it is written at the
 * point of spend — so a plan claiming more than the ledger holds means a plan
 * is asserting money that was never billed, and that is shown rather than
 * averaged away.
 */
export interface Reconciliation {
  ledgerTotalUsd: number;
  /** The ledger minus benchmarks and prompt experiments. */
  ledgerProductionUsd: number;
  /** What the per-video table adds up to. */
  videosAccountForUsd: number;
  /** Benchmarks and experiments: real spend belonging to no video. */
  outsideAnyVideoUsd: number;
  /** Production the ledger holds and no plan claims. Expected to be positive. */
  unaccountedUsd: number;
  /** Plans claiming more than the ledger ever recorded. Must be zero. */
  overclaimedUsd: number;
  agrees: boolean;
}

export interface CapView {
  /** Null means no cap: the default, until he sets one. */
  monthlyUsd: number | null;
  monthSoFarUsd: number;
}

const CREDIT_PATH = path.join(LOCAL_DIR, 'credit.json');
const PAYMENTS_PATH = path.join(LOCAL_DIR, 'payments.json');
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

/**
 * Everything he has recorded paying in. Absent is none, which is where a
 * machine starts; an unreadable file is also none rather than an error, so a
 * hand-edit that goes wrong loses the screen and not the ledger.
 */
export function readPayments(): Payment[] {
  if (!existsSync(PAYMENTS_PATH)) return [];
  try {
    const parsed = JSON.parse(readFileSync(PAYMENTS_PATH, 'utf8')) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is Payment =>
        typeof p === 'object' &&
        p !== null &&
        typeof (p as Payment).id === 'string' &&
        typeof (p as Payment).usd === 'number' &&
        Number.isFinite((p as Payment).usd) &&
        typeof (p as Payment).on === 'string' &&
        typeof (p as Payment).account === 'string',
    );
  } catch {
    return [];
  }
}

function writePayments(payments: readonly Payment[]): void {
  mkdirSync(path.dirname(PAYMENTS_PATH), { recursive: true });
  writeFileSync(PAYMENTS_PATH, `${JSON.stringify(payments, null, 2)}\n`, 'utf8');
}

function checkedPayment(usd: number, on: string, account: string): void {
  if (!Number.isFinite(usd) || usd <= 0) throw new Error('a payment is an amount above zero');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(on)) throw new Error('a payment needs the day it went in');
  if (account.trim() === '') throw new Error('a payment needs the account it went to');
}

export function addPayment(usd: number, on: string, account: string): Payment[] {
  checkedPayment(usd, on, account);
  const payments = readPayments();
  const n = payments.length + 1;
  const entry: Payment = { id: `pay${String(n).padStart(3, '0')}-${Date.now()}`, usd, on, account: account.trim() };
  const next = [...payments, entry];
  writePayments(next);
  return next;
}

export function correctPayment(id: string, usd: number, on: string, account: string): Payment[] {
  checkedPayment(usd, on, account);
  const payments = readPayments();
  if (!payments.some((p) => p.id === id)) throw new Error('there is no payment with that id');
  const next = payments.map((p) => (p.id === id ? { ...p, usd, on, account: account.trim() } : p));
  writePayments(next);
  return next;
}

/**
 * **A payment he typed may be removed, and the ledger's lines may not.**
 *
 * The difference is what each one is. A ledger line is evidence that a call was
 * billed, written at the point of spend; a payment is his own typing about his
 * own bank, and a typo he cannot take back is worse than useless. The removed
 * payment is returned so the screen can name it, and the count is reported —
 * nothing goes quietly.
 */
export function removePayment(id: string): { payments: Payment[]; removed: Payment } {
  const payments = readPayments();
  const removed = payments.find((p) => p.id === id);
  if (removed === undefined) throw new Error('there is no payment with that id');
  const next = payments.filter((p) => p.id !== id);
  writePayments(next);
  return { payments: next, removed };
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
export function reelCosts(
  planPaths: readonly string[],
  lines: readonly LedgerLine[] = [],
): ReelCost[] {
  const byVideo = new Map<string, number[]>();
  for (const l of lines) {
    if (l.video === undefined) continue;
    byVideo.set(l.video, [...(byVideo.get(l.video) ?? []), l.usd]);
  }
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
    const sha256 = typeof source['sha256'] === 'string' ? source['sha256'] : '';
    const ledgerUsd = sumUsd(byVideo.get(sha256) ?? []);
    /*
     * The greater of the two. The ledger is written at the point of spend and
     * cannot hold less than was charged; a plan can, and does.
     */
    const real = ledgerUsd > spent ? ledgerUsd : spent;
    out.push({
      reel: path.basename(p).replace(/\.editplan\.json$/, ''),
      spentUsd: real,
      durationS,
      usdPerSecond: durationS !== null && durationS > 0 ? real / durationS : null,
      stages: Object.entries((costs['spentByStage'] ?? {}) as Record<string, number>)
        .filter(([, v]) => v > 0)
        .map(([k]) => k)
        .sort(),
      planUsd: spent,
      ledgerUsd,
      basis: ledgerUsd === 0 ? 'plan' : ledgerUsd > spent ? 'ledger' : 'both',
    });
  }
  return out.sort((a, b) => b.spentUsd - a.spentUsd);
}

/**
 * Stages that are the tool being built rather than a video being made.
 *
 * Named by what they are: a benchmark compares engines, a langtagging or
 * dial-rule or noise-floor run measures a prompt, and none of them is about one
 * client's reel. Session 46 measured this set at $4.502282 and session 71
 * measured the same figure from the same lines.
 */
const EXPERIMENT_STAGE = /^(benchmark|langtagging|dialrule|noisefloor|promptv2)/;

export function reconcile(lines: readonly LedgerLine[], reels: readonly ReelCost[]): Reconciliation {
  const stages = byStage(lines);
  const outside = sumUsd(stages.filter((g) => EXPERIMENT_STAGE.test(g.key)).map((g) => g.usd));
  const production = sumUsd(stages.filter((g) => !EXPERIMENT_STAGE.test(g.key)).map((g) => g.usd));
  const videos = sumUsd(reels.map((r) => r.spentUsd));
  const round = (n: number): number => Math.round(n * 1_000_000) / 1_000_000;
  const difference = round(production - videos);
  return {
    ledgerTotalUsd: sumUsd(lines.map((l) => l.usd)),
    ledgerProductionUsd: production,
    videosAccountForUsd: videos,
    outsideAnyVideoUsd: outside,
    unaccountedUsd: difference > 0 ? difference : 0,
    /*
     * The ledger is written at the point of spend, so it cannot hold less than
     * was really spent on a reel. A plan claiming more is a plan asserting money
     * nothing ever billed, and that is a defect rather than a rounding gap.
     */
    overclaimedUsd: difference < 0 ? round(-difference) : 0,
    agrees: difference >= 0,
  };
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
  const reels = reelCosts(options.planPaths ?? [], read.lines);
  const payments = readPayments();
  const paidIn = sumUsd(payments.map((p) => p.usd));
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
    perReel: reels,
    cap: { monthlyUsd: readCap(), monthSoFarUsd: monthSoFar },
    paidIn: {
      payments,
      totalInUsd: paidIn,
      impliedLeftUsd: Math.round((paidIn - read.totalUsd) * 1_000_000) / 1_000_000,
    },
    reconciliation: reconcile(read.lines, reels),
  };
}

function spentSince(lines: readonly LedgerLine[], at: string): number {
  return sumUsd(lines.filter((l) => l.timestamp > at).map((l) => l.usd));
}

export { BEFORE_THIS_WAS_RECORDED };
