import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { DOCS_DIR, LOCAL_DIR } from '@framopia/core';
import { scoreOrthography, type FlaggedExample } from './orthography.js';

export const REFERENCE_REELS = ['ground-truth', 'test-1', 'test-2', 'test-3'];

/**
 * The orthography these four transcripts were written in, and are checked
 * against.
 *
 * **It is pinned, not read from the guide.** Until the guide reached v2.0.0
 * these were the same thing, and the check compared each header against
 * whatever version the guide currently carried. v2.0.0 reversed the guide's
 * founding rule — Arabic is written in Arabic letters — and these four files
 * are Arabizi, because a person transcribed four reels by ear under v1.0.x and
 * nothing can regenerate them. Comparing them against v2.0.0 asks whether a
 * record of what was said in 2026-08 obeys a rule made in 2026-08-31, which is
 * not a question about the files.
 *
 * So the check keeps asking the question it can answer: do these four still
 * conform to the rules they were written under? The scorer in `orthography.ts`
 * scores those same v1.0.x rules and is unchanged for the same reason.
 *
 * This moves only when the references themselves are rewritten in a newer
 * orthography — which is a deliberate, expensive act, because they are the WER
 * baseline for the whole project.
 */
export const REFERENCE_ORTHOGRAPHY_VERSION = '1.0.8';

export const GUIDE_PATH = path.join(DOCS_DIR, 'ORTHOGRAPHY_GUIDE.md');
export const REFERENCE_DIR = path.join(LOCAL_DIR, 'ground-truth');

const GUIDE_VERSION_RE = /\(v(\d+\.\d+\.\d+)\)/;
const HEADER_RE = /^#\s*reference-version:\s*(\S+)\s*$/m;

/** Same parse as the transcription fingerprint's, duplicated rather than
 * imported: `benchmarks/` does not depend on `service/`. */
export function readGuideVersion(guidePath = GUIDE_PATH): string {
  const text = readFileSync(guidePath, 'utf8');
  const match = GUIDE_VERSION_RE.exec(text.split('\n', 1)[0] ?? '');
  if (match?.[1] !== undefined) return match[1];
  return `sha256:${createHash('sha256').update(text).digest('hex').slice(0, 16)}`;
}

export function referencePathFor(reel: string, dir = REFERENCE_DIR): string {
  return path.join(dir, `${reel}.txt`);
}

export function parseHeaderVersion(source: string): string | null {
  return HEADER_RE.exec(source)?.[1] ?? null;
}

/** Transcript lines only. `#` lines are the header and the human's notes. */
export function referenceWords(source: string): string[] {
  return source
    .split('\n')
    .filter((line) => !line.startsWith('#'))
    .flatMap((line) => line.split(/\s+/))
    .filter((word) => word.length > 0);
}

export function headerFor(guideVersion: string): string {
  return `# reference-version: v${guideVersion}-conformant`;
}

export interface ReferenceVerdict {
  reel: string;
  headerVersion: string | null;
  expectedVersion: string;
  /** Violations the guide states as rules, excluding the freeze-list check. */
  violations: FlaggedExample[];
  issues: string[];
}

/**
 * The freeze-list near-miss check is deliberately excluded from the pass
 * criterion. It reports 11 false positives across these four files —
 * `l7essass`, `dialo`, `hadi`, `homa` are all correct as written — so gating
 * a build on it would mean gating on noise. Everything else the scorer
 * reports is a rule the guide states outright.
 */
export function verifyReference(reel: string, source: string, expectedVersion: string): ReferenceVerdict {
  const report = scoreOrthography(referenceWords(source));
  const violations = [
    ...report.digitSubstitutions.examples,
    ...report.shDigraph.examples,
    ...report.ouConjunction.examples,
    ...report.proclitic.examples,
    ...report.dialAttachment.examples,
  ];

  const headerVersion = parseHeaderVersion(source);
  const expectedHeader = `v${expectedVersion}-conformant`;
  const issues: string[] = [];

  for (const v of violations) {
    issues.push(`${v.word}: ${v.detail}`);
  }
  if (headerVersion === null) {
    issues.push(`no "# reference-version:" header; expected ${expectedHeader}`);
  } else if (headerVersion !== expectedHeader) {
    issues.push(
      `header says ${headerVersion} but these references are pinned at ${expectedHeader} ` +
        '(REFERENCE_ORTHOGRAPHY_VERSION)',
    );
  }

  return { reel, headerVersion, expectedVersion, violations, issues };
}

export function verifyAllReferences(
  reels = REFERENCE_REELS,
  dir = REFERENCE_DIR,
  expected = REFERENCE_ORTHOGRAPHY_VERSION,
): ReferenceVerdict[] {
  return reels.map((reel) =>
    verifyReference(reel, readFileSync(referencePathFor(reel, dir), 'utf8'), expected),
  );
}

/**
 * Stamps the header, and only after a clean pass. This is the sole writer:
 * §3 of CLAUDE_CODE_GUIDELINES forbids hand-editing the header, because
 * `ground-truth` asserted v1.0.7 conformance for an entire block while
 * violating v1.0.7 and nothing detected it.
 */
export function stampReference(
  reel: string,
  dir = REFERENCE_DIR,
  expected = REFERENCE_ORTHOGRAPHY_VERSION,
): ReferenceVerdict {
  const filePath = referencePathFor(reel, dir);
  const source = readFileSync(filePath, 'utf8');
  const verdict = verifyReference(reel, source, expected);

  if (verdict.violations.length > 0) return verdict;

  const wanted = headerFor(expected);
  const updated = HEADER_RE.test(source)
    ? source.replace(HEADER_RE, wanted)
    : `${wanted}\n${source}`;
  if (updated !== source) writeFileSync(filePath, updated, 'utf8');

  return verifyReference(reel, updated, expected);
}
