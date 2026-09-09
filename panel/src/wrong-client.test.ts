import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * **The tool notices, it does not decide.**
 *
 * Mohamed's ruling of 2026-09-09. The build is never refused: he may build a
 * reel attached to whoever he likes. Nothing here may disable a run button, and
 * nothing may re-attach without him pressing it.
 *
 * Asserted on the source rather than a rendered screen for the reason session 69
 * gave about the cap: a rendering test shows only that today's values leave the
 * button alive, while this shows no arrangement of values could kill it.
 */
const SRC = path.dirname(fileURLToPath(import.meta.url));
const strip = (t: string): string =>
  t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const WRONG = strip(readFileSync(path.join(SRC, 'WrongClient.tsx'), 'utf8'));
const APP = strip(readFileSync(path.join(SRC, 'App.tsx'), 'utf8'));

describe('a video whose client does not match', () => {
  it('never refuses the build', () => {
    // The only disabled in the component is its own offer button, while it works.
    for (const line of WRONG.split('\n')) {
      if (!line.includes('disabled=')) continue;
      expect(line).toContain('busy');
    }
    // And no run button anywhere mentions the mismatch.
    for (const line of APP.split('\n')) {
      if (!line.includes('disabled=')) continue;
      for (const word of ['mismatch', 'looksLike', 'attachedTo', 'wrongClient']) {
        expect(`${word} in "${line.trim()}": ${line.includes(word)}`).toBe(
          `${word} in "${line.trim()}": false`,
        );
      }
    }
  });

  /* Nothing changes unless he presses. There is no effect that attaches. */
  it('re-attaches only when pressed', () => {
    expect(WRONG).toContain('onClick=');
    // No useEffect at all: nothing can fire on render.
    expect(WRONG).not.toContain('useEffect');
    // The one call that changes a plan sits inside the click handler.
    const at = WRONG.indexOf('attachClient(');
    const click = WRONG.indexOf('onClick=');
    expect(at).toBeGreaterThan(click);
  });

  it('sits above the buttons that spend', () => {
    const notice = APP.indexOf('<WrongClient');
    const run = APP.indexOf('<RunActions');
    expect(notice).toBeGreaterThan(-1);
    expect(run).toBeGreaterThan(notice);
  });

  /* Two names and what changes — no path, no version, no id. */
  it('shows only what the service worded, never a path of its own', () => {
    expect(WRONG).toContain('mismatch.says');
    expect(WRONG).toContain('mismatch.offer');
    expect(WRONG).not.toContain('planPath}');
    expect(WRONG).not.toContain('videoPath');
  });

  it('says the previous setting was kept once it has changed', () => {
    expect(WRONG).toContain('was kept, so nothing is lost');
  });
});
