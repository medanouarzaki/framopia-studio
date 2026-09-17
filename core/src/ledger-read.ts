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
/**
 * **Which company actually bills for a call.**
 *
 * Block 15 session 116. The money screen showed one total and one *paid in*, and
 * session 115 measured what that hides: **$0.0559 of ElevenLabs against $12 paid
 * in** — two months of subscription against six cents of use. One pair of numbers
 * cannot say that, and Mohamed has to decide whether he still needs it.
 *
 * **Read off the model**, which is the only thing a ledger line records about
 * where a call went. The names are stable and few: Scribe is ElevenLabs, Gemini
 * and Imagen are Google.
 *
 * `hybrid` is neither, and is not guessed at. It is nine benchmark runs, each a
 * Scribe pass **and** a Gemini correction billed as one figure, and splitting
 * them on screen would be inventing a number. They get their own row, named for
 * what they are.
 */
export type Provider = 'Google' | 'ElevenLabs' | 'more than one';

export function providerOf(model: string): Provider {
  const m = model.toLowerCase();
  if (m.includes('scribe') || m.includes('eleven')) return 'ElevenLabs';
  if (m.includes('gemini') || m.includes('imagen')) return 'Google';
  return 'more than one';
}

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
/**
 * What each company has been billed for.
 *
 * **Spend only.** What he paid *in* to an account is not a ledger line and never
 * will be — a payment is a fact about a bank that nothing here can verify — so
 * the pairing with his payments happens on the screen, as two figures side by
 * side rather than one net one.
 */
export const byProvider = (l: readonly LedgerLine[]): Group[] =>
  groupBy(l, (x) => providerOf(x.model));

/** What a group carries that cannot be attributed, so it is shown and not omitted. */
export function unattributed(groups: readonly Group[]): Group | null {
  return groups.find((g) => g.key === BEFORE_THIS_WAS_RECORDED) ?? null;
}

/** One payment in, as the money screen records it. Declared here so the split below can be shared. */
export interface PaidInEntry {
  usd: number;
  account: string;
}

export interface ProviderSplitRow {
  provider: string;
  spentUsd: number;
  lines: number;
  paidInUsd: number;
  /** Paid in minus spent, for this provider alone. Arithmetic, not a reading. */
  impliedLeftUsd: number;
}

function matchesProvider(account: string, provider: string): boolean {
  const a = account.toLowerCase().replace(/[^a-z]/g, '');
  const p = provider.toLowerCase().replace(/[^a-z]/g, '');
  return p !== '' && a.includes(p);
}

/**
 * **What each company was paid and what it has billed, never netted.**
 *
 * Block 15 session 116. Spend is the ledger, written at the point of a call;
 * paid in is his own entry about a bank, which nothing here can verify. Session
 * 46 lost a session to a computed balance shown as a reading, so the two stay
 * apart and *left* is named as the arithmetic between them.
 *
 * **A payment is matched by the account name he typed, and only when it plainly
 * says so.** One naming no provider is not forced into a bucket — it comes back
 * as `unmatchedPaidInUsd` and is shown, because a figure quietly assigned to the
 * wrong account is worse than one that says it does not know.
 *
 * **Here rather than in the service** so the panel's browser harness computes it
 * the same way the service does. A harness with its own copy of a rule is a
 * second source of truth, and this project has paid for that before.
 */
export function providerSplit(
  lines: readonly LedgerLine[],
  payments: readonly PaidInEntry[],
): { providers: ProviderSplitRow[]; unmatchedPaidInUsd: number } {
  const round = (n: number): number => Math.round(n * 1_000_000) / 1_000_000;
  const spent = byProvider(lines);
  const named = spent.map((g) => g.key);
  const providers = spent.map((g) => {
    const paidInUsd = round(
      payments.filter((p) => matchesProvider(p.account, g.key)).reduce((t, p) => t + p.usd, 0),
    );
    return {
      provider: g.key,
      spentUsd: g.usd,
      lines: g.lines,
      paidInUsd,
      impliedLeftUsd: round(paidInUsd - g.usd),
    };
  });
  const unmatchedPaidInUsd = round(
    payments
      .filter((p) => !named.some((key) => matchesProvider(p.account, key)))
      .reduce((t, p) => t + p.usd, 0),
  );
  return { providers, unmatchedPaidInUsd };
}
