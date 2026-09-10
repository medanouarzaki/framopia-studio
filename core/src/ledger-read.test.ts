import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './paths.js';
import {
  BEFORE_THIS_WAS_RECORDED,
  byClient,
  byMonth,
  byPurpose,
  byStage,
  readLedger,
  sumUsd,
  unattributed,
} from './ledger-read.js';

/**
 * **The reader is the whole back end of the money screen, and it only reads.**
 *
 * Block 11 session 65 found a test writing a fabricated $0.134 charge into the
 * real ledger, on a machine whose ledger did not exist yet, where it stayed.
 * That is why the rule here is structural rather than remembered.
 */
const SOURCE = readFileSync(path.join(REPO_ROOT, 'core', 'src', 'ledger-read.ts'), 'utf8');
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('the ledger reader', () => {
  it('cannot write, because it imports nothing that can', () => {
    for (const forbidden of [
      'node:fs',
      'writeFile',
      'appendFile',
      'copyFile',
      'rmSync',
      'renameSync',
      'openSync',
    ]) {
      expect(`${forbidden}: ${CODE.includes(forbidden)}`).toBe(`${forbidden}: false`);
    }
  });

  it('takes text, not a path, so it has nothing to open', () => {
    // A reader handed a filename is a reader that can be handed a filename to
    // write to. It is given the bytes and hands back an answer.
    expect(CODE).toContain('export function readLedger(text: string)');
    expect(CODE).not.toContain('COSTS_PATH');
  });

  /*
   * A line the reader cannot parse is still money that was spent. Hiding it is
   * how a ledger stops being evidence.
   */
  it('shows a line it cannot parse rather than dropping it', () => {
    const read = readLedger(
      [
        '{"stage":"a","model":"m","unit":"run","usd":1,"timestamp":"2026-01-01T00:00:00.000Z"}',
        'this is not json at all',
        '{"stage":"b","model":"m","unit":"run","usd":2,"timestamp":"2026-01-02T00:00:00.000Z"}',
      ].join('\n'),
    );
    expect(read.lines).toHaveLength(2);
    expect(read.unreadable).toHaveLength(1);
    expect(read.unreadable[0]?.number).toBe(2);
    expect(read.unreadable[0]?.text).toBe('this is not json at all');
  });

  it('keeps a field it does not recognise instead of discarding it', () => {
    const read = readLedger(
      '{"stage":"a","model":"m","unit":"run","usd":1,"timestamp":"2026-01-01T00:00:00.000Z","somethingNew":"kept"}',
    );
    expect(read.lines[0]?.extra).toEqual({ somethingNew: 'kept' });
  });

  it('shows a stage it has no category for under its own name', () => {
    const read = readLedger(
      '{"stage":"a-stage-nobody-has-seen","model":"m","unit":"run","usd":1,"timestamp":"2026-01-01T00:00:00.000Z"}',
    );
    expect(byStage(read.lines)[0]?.key).toBe('a-stage-nobody-has-seen');
  });

  /*
   * Never guessed, never inferred from the cache, never attributed by proximity
   * to a line that does name a client.
   */
  it('calls a line without a client what it is, and does not guess', () => {
    const read = readLedger(
      [
        '{"stage":"a","model":"m","unit":"run","usd":1,"timestamp":"2026-01-01T00:00:00.000Z","client":"k2-syndicalia"}',
        '{"stage":"b","model":"m","unit":"run","usd":2,"timestamp":"2026-01-01T00:00:01.000Z"}',
      ].join('\n'),
    );
    const groups = byClient(read.lines);
    expect(groups.map((g) => g.key).sort()).toEqual(
      [BEFORE_THIS_WAS_RECORDED, 'k2-syndicalia'].sort(),
    );
    // The one beside it names a client; this one still does not.
    expect(unattributed(groups)?.usd).toBe(2);
  });

  /* 77 of the 165 real lines carry more than six decimals. */
  it('adds up without drifting, rounding once at the end', () => {
    expect(sumUsd([0.13441999999999998, 0.13441999999999998])).toBe(0.26884);
    expect(sumUsd([])).toBe(0);
  });
});

describe('the real ledger, read', () => {
  const read = readLedger(
    readFileSync(path.join(REPO_ROOT, '.local', 'costs.jsonl'), 'utf8'),
  );

  /**
   * **The total is the sum of the lines, whatever the lines are.**
   *
   * This asserted `18.832129`, the figure every session report carried from
   * Block 10 session 46 — and it was true for as long as no session spent
   * anything. Block 12 session 84 ran Mohamed's first real reel through the
   * pipeline, seven lines were appended for work he actually paid for, and this
   * went red for the tool working.
   *
   * A frozen total is a test of the ledger's contents, not of the reader, and
   * it makes doing real work look like a regression. What the reader owes is
   * that it loses nothing: the total is what the lines add up to, computed the
   * same way twice and agreeing.
   */
  it('reconciles to the cent', () => {
    expect(read.totalUsd).toBe(sumUsd(read.lines.map((l) => l.usd)));
  });

  /* Money only ever goes up: a total below the historical figure means lines were lost. */
  it('has not lost the spending every session before this recorded', () => {
    expect(read.totalUsd).toBeGreaterThanOrEqual(18.832129);
  });

  it('parses every line', () => {
    expect(read.unreadable).toEqual([]);
    expect(read.lines.length).toBeGreaterThanOrEqual(165);
  });

  /**
   * **No money is lost to grouping**, which is not the same as the two sums
   * being the same float.
   *
   * `sumUsd` rounds once at the end (session 69), so adding 178 values grouped
   * one way and grouped another can differ in the sixth decimal — a millionth of
   * a dollar, from the order of the additions. With 165 lines the two happened
   * to agree exactly and this asserted `toBe`; session 85's seven new lines made
   * them differ by 0.000001 and it went red for floating point, not for a lost
   * charge.
   *
   * A cent is the unit anyone cares about, and it is far coarser than the error
   * this can accumulate; a difference of even one cent would mean a real line
   * had gone missing.
   */
  it('groups the whole total, losing nothing to rounding', () => {
    for (const groups of [byStage(read.lines), byMonth(read.lines), byPurpose(read.lines)]) {
      expect(sumUsd(groups.map((g) => g.usd))).toBeCloseTo(read.totalUsd, 2);
    }
  });

  /* Every line lands in exactly one group of each kind, whatever the arithmetic. */
  it('puts every charge in exactly one group of each kind', () => {
    for (const groups of [byStage(read.lines), byMonth(read.lines), byPurpose(read.lines)]) {
      const counted = groups.reduce((n, g) => n + g.lines, 0);
      expect(counted).toBe(read.lines.length);
    }
  });
});
