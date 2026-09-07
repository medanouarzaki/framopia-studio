import { mkdtempSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appendCost, readCosts } from './costs.js';
import { REPO_ROOT } from './paths.js';

describe('cost ledger', () => {
  let dir: string;
  let costsPath: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'framopia-costs-'));
    costsPath = path.join(dir, 'costs.jsonl');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns empty totals when no ledger exists', () => {
    expect(readCosts(costsPath)).toEqual({});
  });

  it('appends entries and totals them by stage', () => {
    appendCost({ stage: 'transcribe', model: 'elevenlabs', unit: 'minute', usd: 0.1 }, costsPath);
    appendCost({ stage: 'transcribe', model: 'elevenlabs', unit: 'minute', usd: 0.2 }, costsPath);
    appendCost({ stage: 'images', model: 'nano-banana', unit: 'image', usd: 0.5 }, costsPath);

    const totals = readCosts(costsPath);
    expect(totals.transcribe).toBeCloseTo(0.3, 12);
    expect(totals.images).toBeCloseTo(0.5, 12);
  });

  // The ledger is append-only and read back by hand and by scripts, so its
  // serialized shape is a contract. This pins the exact line written for a
  // known entry against a sample taken from .local/costs.jsonl before the
  // move into @framopia/core; key order and number formatting included.
  it('writes a byte-identical ledger line for a known entry', () => {
    appendCost(
      {
        stage: 'benchmark-scribe',
        model: 'scribe',
        unit: 'run',
        usd: 0.0014212344055555555,
      },
      costsPath,
    );
    const line = readFileSync(costsPath, 'utf8').split('\n')[0] ?? '';
    const stamped = line.replace(
      /"timestamp":"[^"]+"/,
      '"timestamp":"2026-08-24T18:30:24.255Z"',
    );
    expect(stamped).toBe(
      '{"stage":"benchmark-scribe","model":"scribe","unit":"run","usd":0.0014212344055555555,"timestamp":"2026-08-24T18:30:24.255Z"}',
    );
  });

  it('carries the correction note field through verbatim', () => {
    appendCost(
      {
        stage: 'benchmark-gemini-correction',
        model: 'gemini',
        unit: 'run',
        usd: 0.12354,
        note: 'delta-only correction',
      },
      costsPath,
    );
    const line = readFileSync(costsPath, 'utf8').split('\n')[0] ?? '';
    expect(line).toContain('"usd":0.12354,"note":"delta-only correction"');
  });
});

/**
 * **No test may bill into the machine's own ledger.**
 *
 * `service/src/images/generate.test.ts` called `generateImages` with
 * `bill: true` and no `costsPath`, so `appendCost` wrote to the real
 * `COSTS_PATH`, and an `afterEach` put the file back — but only
 * `if (before !== '')`. On a machine whose ledger did not exist yet the restore
 * was skipped, and a fabricated $0.134 image charge stayed there for good.
 *
 * Block 11 session 65 reproduced it in the rehearsal clone: the first line in a
 * fresh machine's append-only ledger was a call nobody had made, and
 * `npm run doctor` then reported the ledger present and healthy on the strength
 * of it. On this Mac it went unseen for months because the ledger was never
 * empty, so the restore always ran.
 *
 * A ledger is what every session's spend is measured against. Restoring it
 * afterwards is not good enough either — a run killed midway leaves the line.
 */
describe('the ledger a test writes to', () => {
  const testFiles = (dir: string): string[] => {
    const out: string[] = [];
    const walk = (d: string): void => {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.test.ts')) out.push(full);
      }
    };
    walk(dir);
    return out;
  };

  /** Each `generateImages({ … })` call, by brace balance rather than by regex. */
  const billingCalls = (text: string): string[] => {
    const calls: string[] = [];
    // Built rather than written out, so this file does not match itself.
    for (const opener of ['generateImages' + '({', 'appendCost' + '(']) {
      let from = text.indexOf(opener);
      while (from !== -1) {
        let depth = 0;
        let i = from + opener.length - 1;
        for (; i < text.length; i += 1) {
          const c = text[i];
          if (c === '(' || c === '{') depth += 1;
          else if (c === ')' || c === '}') {
            depth -= 1;
            if (depth === 0) break;
          }
        }
        calls.push(text.slice(from, i + 1));
        from = text.indexOf(opener, i);
      }
    }
    return calls;
  };

  it('is never the real one, in any workspace', () => {
    const offenders: string[] = [];
    for (const dir of ['core', 'service', 'benchmarks']) {
      const root = path.join(REPO_ROOT, dir, 'src');
      if (!existsSync(root)) continue;
      for (const file of testFiles(root)) {
        for (const call of billingCalls(readFileSync(file, 'utf8'))) {
          const bills = call.includes('bill: true') || call.startsWith('appendCost' + '(');
          if (bills && !call.includes('costsPath')) {
            offenders.push(path.relative(REPO_ROOT, file));
          }
        }
      }
    }
    expect([...new Set(offenders)]).toEqual([]);
  });

  /* And nothing writes the file directly either, which is how it was restored. */
  it('is never written to by name', () => {
    const offenders: string[] = [];
    for (const dir of ['core', 'service', 'benchmarks']) {
      const root = path.join(REPO_ROOT, dir, 'src');
      if (!existsSync(root)) continue;
      for (const file of testFiles(root)) {
        const code = readFileSync(file, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/^\s*\/\/.*$/gm, '');
        if (/(write|append)FileSync\(\s*COSTS_PATH/.test(code)) {
          offenders.push(path.relative(REPO_ROOT, file));
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
