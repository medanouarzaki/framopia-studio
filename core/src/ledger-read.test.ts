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

  it('reconciles to the cent', () => {
    // The figure every session report has carried since Block 10 session 46.
    expect(read.totalUsd).toBe(18.832129);
  });

  it('parses every line', () => {
    expect(read.unreadable).toEqual([]);
    expect(read.lines.length).toBeGreaterThanOrEqual(165);
  });

  it('groups the whole total, losing nothing to rounding', () => {
    for (const groups of [byStage(read.lines), byMonth(read.lines), byPurpose(read.lines)]) {
      expect(sumUsd(groups.map((g) => g.usd))).toBe(read.totalUsd);
    }
  });
});
