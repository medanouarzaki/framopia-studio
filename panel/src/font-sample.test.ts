import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The sample must never fall back.
 *
 * Session 16 set `font-family` to After Effects' name and let the browser
 * resolve it, so choosing the italic `AdobeClean-It` drew upright text in a
 * plain sans — a font nobody picked, presented as the sample. Pinned by reading
 * the source, because the failure is the *absence* of a guard rather than a
 * value a unit test could compare.
 */
const SRC = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(SRC, 'NewClient.tsx'), 'utf8');
const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('the font sample', () => {
  it('draws from the resolved file, never from the name alone', () => {
    expect(stripped).toContain('@font-face');
    expect(stripped).toContain('cssFamilyFor');
    // The old line: fontFamily built straight from the chosen name.
    expect(stripped).not.toMatch(/fontFamily: `"\$\{value\}"/);
  });

  it('says a face cannot be shown rather than showing another one', () => {
    expect(stripped).toContain('This font cannot be shown here');
    expect(stripped).toMatch(/face\.file === null/);
  });

  /**
   * A variable font loaded by CSS renders its default instance: the file behind
   * `Inter-SemiBold` is `Inter-VariableFont`, whose default is Regular. Without
   * the axes the sample would be the wrong weight and still look plausible.
   */
  it('applies the variation axes the resolver measured', () => {
    expect(stripped).toContain('fontVariationSettings');
    expect(stripped).toContain('variationSettings(face.axes)');
  });

  it('never uses a generic family as a fallback in the sample', () => {
    const sample = stripped.slice(stripped.indexOf('function FontSample'));
    const body = sample.slice(0, sample.indexOf('\nfunction '));
    expect(body).not.toContain('sans-serif');
    expect(body).not.toContain('serif');
  });

  it('samples Arabic with Arabic text', () => {
    expect(stripped).toContain('شنو كتعرفي');
    expect(stripped).toContain('The quick brown fox');
  });
});

describe('the font list', () => {
  it('narrows on typing and hides nothing', () => {
    expect(stripped).toContain('type="search"');
    expect(stripped).toContain('.filter((n) => n.toLowerCase().includes(needle))');
    // Clearing the box gives the whole list back.
    expect(stripped).toContain("needle === '' ? fonts.names");
  });

  it('keeps the standard one first', () => {
    const field = stripped.slice(stripped.indexOf('function FontField'));
    expect(field.indexOf('The standard one')).toBeLessThan(field.indexOf('shown.map'));
  });
});
