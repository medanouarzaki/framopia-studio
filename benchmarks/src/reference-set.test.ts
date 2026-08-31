import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { REFERENCE_FILES, referenceFilesRootedAt } from '@framopia/core';
import { undeclaredReferenceFiles, verifyReferenceSet } from './reference-set.js';

/**
 * Every case is exercised against copies in a scratch tree. A real reference is
 * never moved, renamed or removed to test the gate that protects it — Block 10
 * session 12 was spent establishing that none had been lost, and a test that
 * risks one is worse than no test.
 */
let root: string;
let files: ReturnType<typeof referenceFilesRootedAt>;

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), 'framopia-refs-'));
  files = referenceFilesRootedAt(root);
  for (const file of files) {
    mkdirSync(path.dirname(file.path), { recursive: true });
    const real = REFERENCE_FILES.find((f) => f.id === file.id);
    copyFileSync(real!.path, file.path);
  }
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

const only = (id: string) => files.filter((f) => f.id === id);

describe('the reference-set gate', () => {
  it('passes on a sound set', () => {
    expect(verifyReferenceSet(files).filter((v) => v.problem !== null)).toEqual([]);
  });

  it('fails, naming the file, when a reference is absent', () => {
    for (const file of files) {
      const held = `${file.path}.held`;
      copyFileSync(file.path, held);
      rmSync(file.path);
      const [verdict] = verifyReferenceSet([file]);
      expect(verdict!.problem).toBe('absent');
      expect(verdict!.issue).toContain(file.path);
      expect(verdict!.issue).toContain('nothing regenerates it');
      copyFileSync(held, file.path);
      rmSync(held);
    }
  });

  it('fails when an alignment reference does not parse', () => {
    const [file] = only('vitasilk alignment review');
    const held = `${file!.path}.held`;
    copyFileSync(file!.path, held);
    writeFileSync(file!.path, '{"schemaVersion":99,"entries":[]}');
    const [verdict] = verifyReferenceSet([file!]);
    expect(verdict!.problem).toBe('unparseable');
    expect(verdict!.issue).toContain(file!.path);
    copyFileSync(held, file!.path);
    rmSync(held);
  });

  it('fails when a transcript has a header but no text', () => {
    const [file] = only('test-1 transcript');
    const held = `${file!.path}.held`;
    copyFileSync(file!.path, held);
    writeFileSync(file!.path, '# reference-version: v1.0.8-conformant\n');
    const [verdict] = verifyReferenceSet([file!]);
    expect(verdict!.problem).toBe('unparseable');
    expect(verdict!.issue).toContain('no transcript text');
    copyFileSync(held, file!.path);
    rmSync(held);
  });

  it('fails on a reference sitting in the directory that nobody declared', () => {
    const stray = path.join(path.dirname(only('vitasilk alignment review')[0]!.path), 'test-9.json');
    writeFileSync(stray, '{}');
    const found = undeclaredReferenceFiles(files);
    expect(found).toContain(stray);
    rmSync(stray);
    expect(undeclaredReferenceFiles(files)).toEqual([]);
  });

  it('does not call a README undeclared', () => {
    const readme = path.join(path.dirname(only('vitasilk alignment review')[0]!.path), 'README.md');
    writeFileSync(readme, 'notes about the references');
    expect(undeclaredReferenceFiles(files)).toEqual([]);
    rmSync(readme);
  });

  it('ignores the tagged .json forms, which npm run bench:tag rebuilds', () => {
    const tagged = path.join(path.dirname(only('test-1 transcript')[0]!.path), 'test-1.json');
    writeFileSync(tagged, '{}');
    expect(undeclaredReferenceFiles(files)).toEqual([]);
    rmSync(tagged);
  });
});
