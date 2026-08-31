import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * No path is typed anywhere in the panel.
 *
 * **User ruling, 2026-08-31**, given while setting up a client and stated for
 * the whole product rather than for that screen. A path is something the
 * machine already knows how to find; asking a person to reproduce one is asking
 * him to do the machine's work and to get it wrong.
 *
 * Pinned by reading the source, the way session 8 pinned every `npm run …` in a
 * user-facing message and session 11 pinned every plan reader. A new screen with
 * a typed path field fails here rather than reaching him.
 */
const SRC = path.dirname(fileURLToPath(import.meta.url));

const PATH_WORDS = ['path', 'folder', 'directory', 'logo', 'file'];

function componentSources(): { file: string; text: string }[] {
  return readdirSync(SRC)
    .filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx'))
    .map((f) => ({ file: f, text: readFileSync(path.join(SRC, f), 'utf8') }));
}

/** Comments describe the rule; only what renders is the rule. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('no path is typed', () => {
  it('every text input whose label names a path is inside PathField', () => {
    const offenders: string[] = [];
    for (const { file, text } of componentSources()) {
      const source = stripComments(text);
      // Each <input type="text" … aria-label="X" …> and the label it carries.
      const inputs = source.match(/<input[\s\S]{0,400}?\/>/g) ?? [];
      for (const tag of inputs) {
        if (!tag.includes("type=\"text\"")) continue;
        const label = /aria-label=\{?["`]?([^"`}\n]*)/.exec(tag)?.[1] ?? '';
        const named = PATH_WORDS.some((w) => label.toLowerCase().includes(w));
        if (!named) continue;
        // The one legitimate text input for a path is PathField's own fallback
        // for a host with no chooser, which is guarded by `dialog ?`.
        const inPathField = source.slice(0, source.indexOf(tag)).includes('function PathField');
        if (!inPathField) offenders.push(`${file}: <input> labelled "${label}"`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the client setup screen chooses its two paths and types neither', () => {
    const source = stripComments(
      readFileSync(path.join(SRC, 'NewClient.tsx'), 'utf8'),
    );
    expect(source).toContain('pickFolder(');
    expect(source).toContain('pickImageFile(');
    // The old typed fields are gone, not merely supplemented.
    expect(source).not.toContain('label="Video folder"\n            hint="The full path');
    expect(source).not.toMatch(/label="Logo"[\s\S]{0,120}?The full path/);
  });

  it('a cancelled chooser never clears what he had', () => {
    const source = readFileSync(path.join(SRC, 'NewClient.tsx'), 'utf8');
    // The picked value is applied only when it is not null.
    expect(source).toMatch(/const picked = choose\(\);\s*\n\s*if \(picked !== null\) onChange\(picked\);/);
  });

  it('one chooser, not a second implementation of one', () => {
    for (const { file, text } of componentSources()) {
      const source = stripComments(text);
      if (file === 'App.tsx' || file === 'NewClient.tsx') continue;
      expect(source).not.toContain('showOpenDialog');
    }
  });
});
