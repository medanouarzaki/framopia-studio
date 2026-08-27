import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CEP_CHROMIUM_VERSION, findUnsupported } from '@framopia/core';

/**
 * The built panel against the engine that has to run it.
 *
 * The headless render check runs a current Chromium and certified a
 * container-query layout that CEP ignored entirely — the panel rendered one
 * column at 1572 px with the breakpoint at 830. **A test environment more
 * capable than the host proves nothing about the host**, so this asserts the
 * shipped bundle against a declared list instead of against whatever the test
 * browser happens to support.
 *
 * It reads `dist` rather than `src` deliberately: the bundler is between them,
 * and esbuild passes a container query through untouched even at
 * `--target=chrome99`, which is why the build could not be the gate.
 */
const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const CSS = path.join(DIST, 'panel.css');
const JS = path.join(DIST, 'panel.js');
const built = existsSync(CSS) && existsSync(JS);

describe.skipIf(!built)(`the bundle runs on CEP's Chromium ${CEP_CHROMIUM_VERSION}`, () => {
  it('uses no CSS feature the engine would drop', () => {
    const findings = findUnsupported(readFileSync(CSS, 'utf8'), 'css');
    expect(
      findings,
      findings.map((f) => `panel.css:${f.line} ${f.name} (Chrome ${f.shippedIn}, ${f.behaviour})`).join('\n'),
    ).toEqual([]);
  });

  it('uses no JavaScript API the engine lacks', () => {
    const findings = findUnsupported(readFileSync(JS, 'utf8'), 'js');
    expect(
      findings,
      findings.map((f) => `panel.js:${f.line} ${f.name} (Chrome ${f.shippedIn}, ${f.behaviour})`).join('\n'),
    ).toEqual([]);
  });

  /* Named separately because it is the one that actually happened. */
  it('contains no container query', () => {
    const css = readFileSync(CSS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).not.toContain('@container');
    expect(css).not.toContain('container-type');
  });

  it('is built from the current source', () => {
    // A stale dist would let the gate pass over a bundle nobody ships.
    const src = readFileSync(path.join(DIST, '..', 'src', 'panel.css'), 'utf8');
    expect(readFileSync(CSS, 'utf8')).toBe(src);
  });
});

describe.skipIf(built)('the bundle', () => {
  it('is not built, so the capability gate is skipped with a notice', () => {
    console.warn('panel/dist is missing — run `npm run panel:build` to run the capability gate');
    expect(built).toBe(false);
  });
});
