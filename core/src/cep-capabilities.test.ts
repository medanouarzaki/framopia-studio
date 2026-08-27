import { describe, expect, it } from 'vitest';
import {
  CEP_CHROMIUM_MAJOR,
  CEP_CHROMIUM_VERSION,
  CEP_UNSUPPORTED,
  findUnsupported,
  stripComments,
} from './cep-capabilities.js';

describe('the recorded engine', () => {
  it('is the Chromium read off the running CEP process', () => {
    expect(CEP_CHROMIUM_VERSION).toBe('99.0.4844.84');
    expect(CEP_CHROMIUM_MAJOR).toBe(99);
  });

  it('lists only features newer than that engine', () => {
    for (const feature of CEP_UNSUPPORTED) {
      expect(feature.shippedIn, feature.name).toBeGreaterThan(CEP_CHROMIUM_MAJOR);
    }
  });
});

describe('findUnsupported', () => {
  /* The exact fault: a layout CEP ignored while a modern Chromium honoured it. */
  it('catches a container query', () => {
    const css = '.app { container-type: inline-size; }\n@container (min-width: 830px) { main { color: red } }';
    const found = findUnsupported(css, 'css').map((f) => f.name);

    expect(found).toContain('CSS container queries (@container)');
    expect(found).toContain('CSS container-type');
  });

  it('reports the line and what CEP does with it', () => {
    const [finding] = findUnsupported('a{}\nb{}\n.x:has(.y){}', 'css');
    expect(finding?.name).toBe('CSS :has()');
    expect(finding?.line).toBe(3);
    expect(finding?.behaviour).toBe('ignored silently');
    expect(finding?.shippedIn).toBe(105);
  });

  it('catches a JavaScript API newer than the engine', () => {
    expect(findUnsupported('const g = Object.groupBy(xs, f);', 'js')[0]?.name).toBe('Object.groupBy');
    expect(findUnsupported('xs.toSorted()', 'js')[0]?.behaviour).toBe('throws');
  });

  it('leaves alone what Chromium 99 already had', () => {
    const css = '.a { display: grid; gap: 10px; overflow-wrap: anywhere; aspect-ratio: 1; }';
    expect(findUnsupported(css, 'css')).toEqual([]);
    expect(findUnsupported('new ResizeObserver(fn); structuredClone(x); a?.b ?? c;', 'js')).toEqual([]);
  });

  /*
   * The stylesheet's own comment explains why the container query was removed,
   * and this file's does too. A gate that flagged the explanation would be
   * unusable — the same lesson as the ledger-name test that flagged its own
   * doc comment.
   */
  it('ignores a feature named only in a comment', () => {
    expect(findUnsupported('/* @container was removed: container-type is Chrome 105 */\na{}', 'css')).toEqual([]);
    expect(findUnsupported('// Object.groupBy is too new\nconst a = 1;', 'js')).toEqual([]);
  });

  it('strips block comments in CSS and line comments in JS', () => {
    expect(stripComments('/* x */a{}', 'css')).toBe('a{}');
    expect(stripComments('// x\na;', 'js').trim()).toBe('a;');
    // A CSS file has no `//` comments; a URL must survive.
    expect(stripComments('a{background:url(http://x/y)}', 'css')).toContain('http://x/y');
  });
});
