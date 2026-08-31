import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './paths.js';
import { savedOutputNote, savedOutputSentence } from './saved-output.js';

const BUILD = '/repo/.local/build';

describe('what to say about the project the build saved', () => {
  it('says nothing when nothing was saved', () => {
    expect(savedOutputNote(null, `${BUILD}/vitasilk-full.aep`)).toEqual({ kind: 'none' });
    expect(savedOutputSentence({ kind: 'none' })).toBeNull();
  });

  /**
   * The defect: the user's first panel build printed the same path twice, once
   * as the composition and once as a rescue, and the second was about to be
   * overwritten by the first.
   */
  it('does not call saving the file it is about to overwrite a rescue', () => {
    const same = `${BUILD}/vitasilk-full.aep`;
    const note = savedOutputNote(same, same);
    expect(note).toEqual({ kind: 'same-file' });
    const sentence = savedOutputSentence(note);
    expect(sentence).not.toBeNull();
    expect(sentence).not.toContain(same);
    expect(sentence).not.toContain('saved first');
    expect(sentence).toContain('replaced it');
  });

  it('names the file when a different reel was open, which is the useful case', () => {
    const note = savedOutputNote(`${BUILD}/test_1-full.aep`, `${BUILD}/vitasilk-full.aep`);
    expect(note).toEqual({ kind: 'other-file', path: `${BUILD}/test_1-full.aep` });
    const sentence = savedOutputSentence(note) ?? '';
    expect(sentence).toContain('test_1-full.aep');
    expect(sentence).not.toContain('vitasilk-full.aep');
    expect(sentence).toContain('saved first');
  });

  it('treats an unknown save path as a different file rather than guessing', () => {
    expect(savedOutputNote(`${BUILD}/test_1-full.aep`, null)).toEqual({
      kind: 'other-file',
      path: `${BUILD}/test_1-full.aep`,
    });
  });

  /**
   * One rule, two readers. The panel and the terminal both print this sentence,
   * and a second copy of the comparison is how the two would come to disagree.
   */
  it('is the only implementation the panel and the CLI use', () => {
    const strip = (s: string): string =>
      s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const file of ['panel/src/Build.tsx', 'service/src/build/build-reel-cli.ts']) {
      const source = strip(readFileSync(path.join(REPO_ROOT, file), 'utf8'));
      expect(source).toContain('savedOutputSentence');
      expect(source).not.toContain('was open with unsaved changes, so it was saved first');
    }
  });
});
