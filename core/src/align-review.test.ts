import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ALIGN_REFERENCE_SCHEMA_VERSION,
  AlignReferenceError,
  buildAlignmentRows,
  parseAlignReference,
  serializeAlignReference,
  tokenScript,
  type AlignReference,
} from './align-review.js';
import { REPO_ROOT } from './paths.js';

const draft = [
  { text: 'Vita', start: 8.2, end: 8.5 },
  { text: 'من', start: 8.9, end: 9.0 },
  { text: 'غير', start: 9.1, end: 9.2 },
];

describe('buildAlignmentRows', () => {
  it('reports the aligner’s own operations, one row per corrected word', () => {
    const rows = buildAlignmentRows(draft, ['Vita', 'mn', 'ghir']);

    expect(rows.map((r) => r.op)).toEqual(['match', 'substitute', 'substitute']);
    expect(rows.map((r) => r.draftText)).toEqual(['Vita', 'من', 'غير']);
    expect(rows.map((r) => r.crossScript)).toEqual([false, true, true]);
    expect(rows.map((r) => r.wordId)).toEqual(['w0000', 'w0001', 'w0002']);
    expect(rows[1]?.draftStart).toBe(8.9);
    expect(rows[1]?.draftEnd).toBe(9.0);
  });

  it('gives an inserted word no draft token rather than a nearby one', () => {
    const rows = buildAlignmentRows(draft, ['Vita', 'w', 'mn', 'ghir']);

    const inserted = rows.filter((r) => r.op === 'insert');
    expect(inserted).toHaveLength(1);
    expect(inserted[0]?.draftIndex).toBeNull();
    expect(inserted[0]?.draftText).toBeNull();
    expect(inserted[0]?.crossScript).toBe(false);
    expect(rows).toHaveLength(4);
  });

  it('never emits a row for a deleted draft token', () => {
    const rows = buildAlignmentRows(draft, ['Vita']);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.op).toBe('match');
  });

  it('classifies script by the characters', () => {
    expect(tokenScript('من')).toBe('arabic');
    expect(tokenScript('mn')).toBe('latin');
    expect(tokenScript('26')).toBe('latin');
  });
});

const reference: AlignReference = {
  schemaVersion: ALIGN_REFERENCE_SCHEMA_VERSION,
  reel: 'vitasilk',
  generatedAt: '2026-08-27T00:00:00.000Z',
  headSha: 'e1518e4795c3960ce162ead6a56421138081dfc8',
  entries: [
    { wordId: 'w0001', wordText: 'mn', draftTokenText: 'من', verdict: 'correct' },
    { wordId: 'w0002', wordText: 'ghir', draftTokenText: 'أنه', verdict: 'wrong', note: 'one late' },
    { wordId: 'w0030', wordText: '26', draftTokenText: 'ستة', verdict: 'two-tokens' },
    { wordId: 'w0031', wordText: 'w', draftTokenText: null, verdict: 'no-token' },
  ],
};

describe('parseAlignReference', () => {
  it('round-trips a reference', () => {
    expect(parseAlignReference(JSON.parse(serializeAlignReference(reference)))).toEqual(reference);
  });

  it('rejects a file with no HEAD sha', () => {
    const { headSha, ...rest } = reference;
    expect(headSha).toBeTruthy();
    expect(() => parseAlignReference(rest)).toThrow(AlignReferenceError);
    expect(() => parseAlignReference(rest)).toThrow(/headSha/);
  });

  it('rejects a file with no schema version', () => {
    const { schemaVersion, ...rest } = reference;
    expect(schemaVersion).toBe(ALIGN_REFERENCE_SCHEMA_VERSION);
    expect(() => parseAlignReference(rest)).toThrow(/schemaVersion/);
  });

  it('rejects a schema version this build cannot read', () => {
    expect(() => parseAlignReference({ ...reference, schemaVersion: 99 })).toThrow(/schemaVersion 99/);
  });

  it('rejects a verdict outside the four', () => {
    expect(() =>
      parseAlignReference({ ...reference, entries: [{ ...reference.entries[0], verdict: 'maybe' }] }),
    ).toThrow(/verdict/);
  });
});

/**
 * The review sheet is an instrument: it must not be able to spend money or
 * reach the network, whatever a later edit does to it. A comment saying so is
 * a claim nobody checks (CLAUDE_CODE_GUIDELINES §3), so the import graph is
 * pinned instead.
 *
 * `@framopia/core` — the barrel — is deliberately forbidden: it re-exports
 * `appendCost` and `COSTS_PATH`, so importing it puts the ledger writer one
 * property access away. The tool takes the `./align-review` subpath, whose
 * graph is `align` and `normalizeToken`.
 */
describe('tools/align-review cannot spend money or reach the network', () => {
  const toolDir = path.join(REPO_ROOT, 'tools', 'align-review');
  const allowedModules = new Set([
    '@framopia/core/align-review',
    '@framopia/core/align-score',
    '@framopia/core/aligner-hash',
    '@framopia/core/cache-select',
  ]);
  const allowedBuiltins = new Set(['node:fs', 'node:path', 'node:url']);
  const importRe = /(?:^|\n)\s*import\s[^;]*?from\s+['"]([^'"]+)['"]/g;
  const dynamicRe = /\b(?:require|import)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  /**
   * Comments are stripped before the checks below: the rule is about what the
   * code does, and a comment explaining why the ledger writer is avoided must
   * not read as an import of it. Block comments and whole-line `//` comments
   * only, so nothing inside a string literal is touched.
   */
  const stripComments = (text: string): string =>
    text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  const sources = readdirSync(toolDir)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => ({ file: f, text: stripComments(readFileSync(path.join(toolDir, f), 'utf8')) }));

  it('has sources to check', () => {
    expect(sources.length).toBeGreaterThan(0);
  });

  it.each(sources)('$file imports only permitted modules', ({ text }) => {
    const specifiers: string[] = [];
    for (const re of [importRe, dynamicRe]) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) specifiers.push(m[1] as string);
    }

    for (const spec of specifiers) {
      if (spec.startsWith('.')) continue;
      const ok = allowedModules.has(spec) || allowedBuiltins.has(spec);
      expect(ok, `${spec} is not on the align-review allowlist`).toBe(true);
    }
  });

  it.each(sources)('$file makes no network call', ({ text }) => {
    expect(text).not.toMatch(/\bfetch\s*\(/);
    expect(text).not.toMatch(/\bXMLHttpRequest\b/);
    expect(text).not.toMatch(/https?:\/\//);
  });

  it.each(sources)('$file never names the cost ledger', ({ text }) => {
    expect(text).not.toMatch(/\bappendCost\b/);
    expect(text).not.toMatch(/\bCOSTS_PATH\b/);
    expect(text).not.toMatch(/costs\.jsonl/);
  });
});
