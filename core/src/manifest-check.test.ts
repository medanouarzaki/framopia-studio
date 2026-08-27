import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  checkManifest,
  findDoubleHyphenComments,
  PANEL_MANIFEST_PATH,
} from './manifest-check.js';

const dir = mkdtempSync(path.join(tmpdir(), 'framopia-manifest-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function write(name: string, xml: string): string {
  const file = path.join(dir, name);
  writeFileSync(file, xml);
  return file;
}

const WRAP = (inner: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<ExtensionManifest>\n${inner}\n</ExtensionManifest>\n`;

describe('findDoubleHyphenComments', () => {
  /*
   * The exact shape that took the panel down: a comment about command-line
   * flags, naming the flags.
   */
  it('catches a flag named inside a comment', () => {
    const issues = findDoubleHyphenComments(
      WRAP('  <!-- CEP needs --enable-nodejs and --mixed-context -->'),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]?.line).toBe(3);
    expect(issues[0]?.message).toContain('XML forbids');
  });

  it('catches a double hyphen anywhere in a comment, not only at its end', () => {
    expect(findDoubleHyphenComments(WRAP('  <!-- a -- b -->'))).toHaveLength(1);
    expect(findDoubleHyphenComments(WRAP('  <!-- trailing -- -->'))).toHaveLength(1);
  });

  it('reports every offending comment, not just the first', () => {
    expect(
      findDoubleHyphenComments(WRAP('  <!-- --one -->\n  <b/>\n  <!-- --two -->')),
    ).toHaveLength(2);
  });

  it('leaves a clean comment alone, and single hyphens alone', () => {
    expect(findDoubleHyphenComments(WRAP('  <!-- enable-nodejs, mixed-context -->'))).toEqual([]);
  });

  /*
   * A hyphen pair in element content is legal and must not be flagged, or the
   * check would forbid the very Parameter lines it exists to protect.
   */
  it('does not flag a double hyphen outside a comment', () => {
    expect(findDoubleHyphenComments(WRAP('  <Parameter>--enable-nodejs</Parameter>'))).toEqual([]);
  });
});

describe('checkManifest', () => {
  it('fails a manifest with a double hyphen inside a comment', () => {
    const file = write('bad.xml', WRAP('  <!-- needs --enable-nodejs -->'));
    const result = checkManifest(file);

    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes('XML forbids'))).toBe(true);
  });

  it('fails any other parse error too, when xmllint is available', () => {
    const file = write('unclosed.xml', '<?xml version="1.0"?>\n<a><b></a>\n');
    const result = checkManifest(file);

    if (!result.parsedWithXmllint) {
      console.warn('manifest-check: xmllint absent, full parse not exercised');
      return;
    }
    expect(result.ok).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('passes a well-formed manifest', () => {
    const file = write('good.xml', WRAP('  <Parameter>--enable-nodejs</Parameter>'));
    expect(checkManifest(file)).toMatchObject({ ok: true, issues: [] });
  });

  it('fails a manifest that is not there rather than passing', () => {
    expect(checkManifest(path.join(dir, 'absent.xml')).ok).toBe(false);
  });

  /* The one that matters: the file After Effects actually reads. */
  it('passes the panel manifest in the repo', () => {
    const result = checkManifest(PANEL_MANIFEST_PATH);
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });
});
