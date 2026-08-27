import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './paths.js';

/**
 * Well-formedness of the CEP extension manifest.
 *
 * A malformed manifest passed every test in this repo and failed silently at
 * launch: After Effects dropped the extension, it vanished from the Extensions
 * menu, and the only trace was `XPATH Double hyphen within comment` in a CEP
 * log nobody reads. Nothing in the build could have caught it, because nothing
 * parsed the file.
 *
 * Two stages, with different scopes rather than two copies of one rule:
 *
 * 1. **The double-hyphen rule**, in JavaScript, because it is the specific
 *    footgun that took the panel down and it must be caught on any machine.
 * 2. **Full well-formedness**, via `xmllint` — libxml2, the same parser family
 *    CEP uses, so what it rejects is what After Effects rejects. It ships with
 *    macOS, which is the only platform this project targets; when it is
 *    missing the check says so rather than passing quietly.
 */
export const PANEL_MANIFEST_PATH = path.join(REPO_ROOT, 'panel', 'CSXS', 'manifest.xml');

export interface ManifestCheckIssue {
  /** 1-indexed, or null when the parser did not report one. */
  line: number | null;
  message: string;
}

export interface ManifestCheckResult {
  ok: boolean;
  issues: ManifestCheckIssue[];
  /** False when xmllint is absent, so a caller can say the check was partial. */
  parsedWithXmllint: boolean;
}

/**
 * `--` is illegal anywhere inside an XML comment, not merely at its end. The
 * usual way to hit it is naming a command-line flag in a comment about
 * command-line flags.
 */
export function findDoubleHyphenComments(xml: string): ManifestCheckIssue[] {
  const issues: ManifestCheckIssue[] = [];
  const commentRe = /<!--([\s\S]*?)(?:-->|$)/g;
  let match: RegExpExecArray | null;
  while ((match = commentRe.exec(xml)) !== null) {
    const body = match[1] ?? '';
    if (!body.includes('--')) continue;
    const line = xml.slice(0, match.index).split('\n').length;
    issues.push({
      line,
      message:
        'a comment contains "--", which XML forbids. Name flags without the leading ' +
        'hyphens, or move the explanation outside the comment.',
    });
  }
  return issues;
}

function xmllintIssues(file: string): { issues: ManifestCheckIssue[]; ran: boolean } {
  try {
    execFileSync('xmllint', ['--noout', file], { stdio: ['ignore', 'ignore', 'pipe'] });
    return { issues: [], ran: true };
  } catch (error) {
    const err = error as { code?: string; stderr?: Buffer };
    if (err.code === 'ENOENT') return { issues: [], ran: false };
    const stderr = err.stderr?.toString() ?? 'xmllint reported a parse error';
    const issues = stderr
      .split('\n')
      .filter((l) => l.includes('parser error') || l.includes('error :'))
      .map((l) => {
        const m = /:(\d+):/.exec(l);
        return { line: m?.[1] === undefined ? null : Number(m[1]), message: l.trim() };
      });
    return { issues: issues.length > 0 ? issues : [{ line: null, message: stderr.trim() }], ran: true };
  }
}

export function checkManifest(file = PANEL_MANIFEST_PATH): ManifestCheckResult {
  if (!existsSync(file)) {
    return { ok: false, issues: [{ line: null, message: `no manifest at ${file}` }], parsedWithXmllint: false };
  }
  const xml = readFileSync(file, 'utf8');
  const issues = findDoubleHyphenComments(xml);
  const { issues: parserIssues, ran } = xmllintIssues(file);
  issues.push(...parserIssues);
  return { ok: issues.length === 0, issues, parsedWithXmllint: ran };
}
