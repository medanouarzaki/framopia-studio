/**
 * No AI fingerprints anywhere — checked, rather than remembered.
 *
 * PROJECT_SPEC §1 and CLAUDE_CODE_GUIDELINES §1 forbid attribution trailers,
 * tool banners and generated-by markers in the repository, in commit messages
 * and in documentation. Enforcement was a person noticing: Block 10 session 14
 * found `# block-N-session-M.md Claude Code reports` in
 * `docs/ARCHITECTURE.md`'s repo layout, where it had survived every session
 * since the file was written because nobody had opened it.
 *
 * **The line between a marker and a legitimate mention is whether it is
 * quoted.** This repository's own documents state the rule, and stating it
 * means writing the forbidden strings down — `no "Generated with Claude Code"`
 * in CLAUDE.md, `Never add "Generated with Claude Code", "Co-Authored-By:
 * Claude"` in the guidelines, and the same in PROJECT_SPEC §1 and the block
 * handoff. Every one of them quotes the marker; an actual attribution never
 * does, because it is written to be read as a sentence. So an occurrence
 * wrapped in `"`, `'` or a backtick is the rule being documented and is
 * allowed, and a bare one is a finding.
 *
 * **What this cannot catch, stated so nobody mistakes it for complete:** prose
 * that names the tool as the author of something without using any marker
 * phrase. That is exactly what session 14 removed, and the project's own
 * planning documents describe their working method in nearly the same words —
 * `docs/HANDOFF_PROTOCOL.md` says the executor is Claude Code, which is a fact
 * about how the work is organised and must not fail a gate. Distinguishing the
 * two needs a human reading a sentence. This catches the mechanical forms, and
 * those are what tooling injects.
 */

export interface AttributionPattern {
  readonly id: string;
  readonly what: string;
  readonly re: RegExp;
}

/**
 * Derived from what has actually appeared or is named by the rule.
 *
 * Every pattern is global and case-insensitive where the form allows it; the
 * trailer forms are anchored to the start of a line, because that is what a
 * git trailer is and a mid-sentence mention of one is prose about it.
 */
export const ATTRIBUTION_PATTERNS: readonly AttributionPattern[] = [
  {
    id: 'co-authored-trailer',
    what: 'a Co-Authored-By trailer naming an AI',
    re: /^[ \t>*-]*co-authored-by:\s*(claude|chatgpt|gpt-|copilot|codex|an? ai\b)/gim,
  },
  {
    id: 'generated-with',
    what: 'a generated-with tool banner',
    re: /generated with\s+\[?(claude|chatgpt|gpt-|copilot|codex|ai\b)/gi,
  },
  {
    id: 'generated-by',
    what: 'a generated-by, written-by or created-with attribution',
    // "generated with" is `generated-with` above; excluded here so one banner
    // is not reported twice under two names.
    re: /\b(generated\s+by|(written|authored|created|produced)\s+(by|with))\s+(claude(?!\s+(project|opus|code guidelines))|chatgpt|copilot|codex|an? ai\b)/gi,
  },
  {
    id: 'robot-emoji',
    what: 'the robot emoji tool banner',
    re: /\u{1F916}/gu,
  },
  {
    id: 'assistant-url',
    what: 'a link to the assistant that produced the work',
    re: /https?:\/\/(claude\.ai\/code|claude\.com\/claude-code|chat\.openai\.com)/gi,
  },
  {
    id: 'as-an-ai',
    what: 'assistant boilerplate',
    re: /\bas an ai (language )?model\b/gi,
  },
];

export interface AttributionHit {
  readonly source: string;
  readonly line: number;
  readonly patternId: string;
  readonly what: string;
  /** The line, trimmed, so a reader can see it without opening the file. */
  readonly text: string;
}

/** Is the match wrapped in quotes or backticks — the repo documenting the rule? */
function isQuoted(line: string, at: number, length: number): boolean {
  const before = line.slice(0, at);
  const after = line.slice(at + length);
  for (const q of ['"', "'", '`', '“', '”', '‘', '’']) {
    // A quote immediately before and a closing one after, allowing for the rest
    // of the quoted phrase on either side.
    const opens = before.lastIndexOf(q === '”' ? '“' : q === '’' ? '‘' : q);
    if (opens === -1) continue;
    const closes = after.indexOf(q === '“' ? '”' : q === '‘' ? '’' : q);
    if (closes === -1) continue;
    // Nothing may close the quote between the opener and the match.
    if (!before.slice(opens + 1).includes(q === '”' ? '”' : q)) return true;
  }
  return false;
}

export function findAttribution(source: string, text: string): AttributionHit[] {
  const hits: AttributionHit[] = [];
  const lines = text.split('\n');
  for (const pattern of ATTRIBUTION_PATTERNS) {
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] as string;
      const re = new RegExp(pattern.re.source, pattern.re.flags);
      let m: RegExpExecArray | null;
      while ((m = re.exec(line)) !== null) {
        if (m[0].length === 0) break;
        if (isQuoted(line, m.index, m[0].length)) continue;
        hits.push({
          source,
          line: i + 1,
          patternId: pattern.id,
          what: pattern.what,
          text: line.trim().slice(0, 160),
        });
      }
    }
  }
  return hits.sort((a, b) => a.line - b.line || a.patternId.localeCompare(b.patternId));
}

export function formatAttributionHit(hit: AttributionHit): string {
  return `  ${hit.source}:${hit.line}  ${hit.what}\n      ${hit.text}`;
}
