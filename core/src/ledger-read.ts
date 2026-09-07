import type { SpendPurpose } from './costs.js';

/**
 * **Reading the cost ledger, and nothing else.**
 *
 * The ledger is an append-only record of real money. Block 11 session 65 found a
 * *test* writing a fabricated $0.134 charge into it, so the rule here is
 * structural rather than remembered: **this module imports nothing that can
 * write.** No `node:fs`, no path to a file, no way to open one. It is handed the
 * text and hands back an answer, which is why `service/src/money.ts` is the only
 * thing that reads the file and why that file is opened read-only.
 *
 * **No database, no cache, no index.** Block 12 session 68 measured 165 lines;
 * parsing them whole takes no measurable time and would not at a hundred times
 * the size. An index would be a second copy of the money, and a second copy is a
 * thing that can disagree.
 *
 * **A line it does not understand is shown, never dropped.** A stage it has no
 * category for appears under its own name; a line that is not JSON at all is
 * carried in `unreadable` and counted as present. Hiding a line the reader
 * cannot parse is how a ledger stops being evidence — the money was still spent.
 */
export interface LedgerLine {
  stage: string;
  model: string;
  unit: string;
  usd: number;
  timestamp: string;
  client?: string;
  video?: string;
  purpose?: SpendPurpose;
  note?: string;
  /**
   * Anything else the line carried. Kept rather than discarded: a field written
   * by a later version of this tool is not the reader's to throw away.
   */
  extra?: Record<string, unknown>;
}

/** A line that could not be parsed. Present, counted, and shown as itself. */
export interface UnreadableLine {
  /** 1-based, so it can be pointed at in the file. */
  number: number;
  text: string;
  cause: string;
}

export interface Ledger {
  lines: LedgerLine[];
  unreadable: UnreadableLine[];
  /** Every line's `usd`, to the cent. */
  totalUsd: number;
  /** The earliest and latest timestamps, or null when there are no lines. */
  firstAt: string | null;
  lastAt: string | null;
}

const KNOWN = new Set([
  'stage',
  'model',
  'unit',
  'usd',
  'timestamp',
  'client',
  'video',
  'purpose',
  'note',
]);

/**
 * Money added up so that it reconciles.
 *
 * **Rounded once at the end, never per line.** 77 of the 165 lines carry a `usd`
 * with more than six decimal places — `0.13441999999999998` is what the provider's
 * usage figures multiply out to — so rounding each line to millionths first and
 * adding those discards real precision and drifts: measured, it gives
 * $18.832131 against the $18.832129 on record. Adding the doubles as they are
 * and rounding the total once gives $18.832129 exactly.
 *
 * Six decimals because that is the finest anything here is priced at; the
 * rounding is for the last-place noise of binary floating point, not for the
 * money.
 */
export function sumUsd(values: readonly number[]): number {
  let total = 0;
  for (const v of values) total += v;
  return Math.round(total * 1_000_000) / 1_000_000;
}

export function readLedger(text: string): Ledger {
  const lines: LedgerLine[] = [];
  const unreadable: UnreadableLine[] = [];

  text.split('\n').forEach((raw, i) => {
    if (raw.trim() === '') return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      unreadable.push({ number: i + 1, text: raw, cause: (error as Error).message });
      return;
    }
    if (parsed === null || typeof parsed !== 'object') {
      unreadable.push({ number: i + 1, text: raw, cause: 'not an object' });
      return;
    }
    const r = parsed as Record<string, unknown>;
    if (typeof r['usd'] !== 'number' || !Number.isFinite(r['usd'])) {
      unreadable.push({ number: i + 1, text: raw, cause: 'no usd amount' });
      return;
    }
    const extra: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) if (!KNOWN.has(k)) extra[k] = v;

    lines.push({
      stage: typeof r['stage'] === 'string' ? r['stage'] : '(no stage recorded)',
      model: typeof r['model'] === 'string' ? r['model'] : '(no model recorded)',
      unit: typeof r['unit'] === 'string' ? r['unit'] : '(no unit recorded)',
      usd: r['usd'],
      timestamp: typeof r['timestamp'] === 'string' ? r['timestamp'] : '',
      ...(typeof r['client'] === 'string' ? { client: r['client'] } : {}),
      ...(typeof r['video'] === 'string' ? { video: r['video'] } : {}),
      ...(r['purpose'] === 'building' || r['purpose'] === 'client-work'
        ? { purpose: r['purpose'] }
        : {}),
      ...(typeof r['note'] === 'string' ? { note: r['note'] } : {}),
      ...(Object.keys(extra).length > 0 ? { extra } : {}),
    });
  });

  const stamps = lines.map((l) => l.timestamp).filter((t) => t !== '').sort();
  return {
    lines,
    unreadable,
    totalUsd: sumUsd([...lines.map((l) => l.usd), ...unreadable.map(() => 0)]),
    firstAt: stamps[0] ?? null,
    lastAt: stamps[stamps.length - 1] ?? null,
  };
}

export interface Group {
  key: string;
  lines: number;
  usd: number;
}

/**
 * **What a line without the field is called, and it is never a guess.**
 *
 * Session 68 added `client`, `video` and `purpose`; the 165 lines written before
 * it have none of them. Session 46 rebuilt a per-reel table from `.local/cache/`
 * and session 68 measured that the same reconstruction now recovers only 54.9%
 * and falls with every run. So the old lines are grouped honestly under one
 * label and never attributed to a client by the cache, by their timestamp, or by
 * what happened to be open at the time.
 */
export const BEFORE_THIS_WAS_RECORDED = 'before this was recorded';

function groupBy(lines: readonly LedgerLine[], of: (l: LedgerLine) => string): Group[] {
  const acc = new Map<string, number[]>();
  for (const l of lines) {
    const k = of(l);
    acc.set(k, [...(acc.get(k) ?? []), l.usd]);
  }
  return [...acc.entries()]
    .map(([key, values]) => ({ key, lines: values.length, usd: sumUsd(values) }))
    .sort((a, b) => b.usd - a.usd || a.key.localeCompare(b.key));
}

export const byStage = (l: readonly LedgerLine[]): Group[] => groupBy(l, (x) => x.stage);
export const byModel = (l: readonly LedgerLine[]): Group[] => groupBy(l, (x) => x.model);
export const byDay = (l: readonly LedgerLine[]): Group[] =>
  groupBy(l, (x) => (x.timestamp === '' ? '(no date recorded)' : x.timestamp.slice(0, 10)));
export const byMonth = (l: readonly LedgerLine[]): Group[] =>
  groupBy(l, (x) => (x.timestamp === '' ? '(no date recorded)' : x.timestamp.slice(0, 7)));
export const byClient = (l: readonly LedgerLine[]): Group[] =>
  groupBy(l, (x) => x.client ?? BEFORE_THIS_WAS_RECORDED);
export const byVideo = (l: readonly LedgerLine[]): Group[] =>
  groupBy(l, (x) => x.video ?? BEFORE_THIS_WAS_RECORDED);
export const byPurpose = (l: readonly LedgerLine[]): Group[] =>
  groupBy(l, (x) => x.purpose ?? BEFORE_THIS_WAS_RECORDED);

/** What a group carries that cannot be attributed, so it is shown and not omitted. */
export function unattributed(groups: readonly Group[]): Group | null {
  return groups.find((g) => g.key === BEFORE_THIS_WAS_RECORDED) ?? null;
}
