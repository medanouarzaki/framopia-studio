import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { DOCS_DIR } from '@framopia/core';
import { resolveTranscriptionEntry } from './resolve-entry.js';
import { fingerprintOf, readGuideVersion, transcriptionFingerprintInputs } from './fingerprint.js';
import { ACTIVE_PROMPT_VERSION } from './correction.js';

const SHA = 'a'.repeat(64);

function entryAt(root: string, fingerprint: string, promptVersion: number): void {
  const dir = path.join(root, SHA, `transcription-${fingerprint}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ promptVersion }), 'utf8');
}

async function fingerprintAt(guideVersion: string, promptVersion: number): Promise<string> {
  const inputs = await transcriptionFingerprintInputs({ keyterms: [] });
  return fingerprintOf({
    ...inputs,
    promptVersion: promptVersion as typeof inputs.promptVersion,
    guideVersion,
  });
}

describe('resolveTranscriptionEntry', () => {
  it('reports exact when the current configuration is on disk', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'framopia-resolve-'));
    const guide = await readGuideVersion();
    entryAt(root, await fingerprintAt(guide, ACTIVE_PROMPT_VERSION), ACTIVE_PROMPT_VERSION);
    const r = await resolveTranscriptionEntry({ videoSha256: SHA, keyterms: [], cacheRoot: root });
    expect(r.provenance).toBe('exact');
  });

  it('reports compatible for the pinned corpus: same prompt version, guide v1.0.7', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'framopia-resolve-'));
    entryAt(root, await fingerprintAt('1.0.7', ACTIVE_PROMPT_VERSION), ACTIVE_PROMPT_VERSION);
    const r = await resolveTranscriptionEntry({ videoSha256: SHA, keyterms: [], cacheRoot: root });
    expect(r.provenance).toBe('compatible');
    expect(r.entryGuideVersion).toBe('1.0.7');
    expect(r.note).toContain('will not bill');
  });

  it('reports none for an entry at another prompt version', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'framopia-resolve-'));
    entryAt(root, await fingerprintAt('1.0.7', 3), 3);
    const r = await resolveTranscriptionEntry({ videoSha256: SHA, keyterms: [], cacheRoot: root });
    expect(r.provenance).toBe('none');
    expect(r.note).toContain('bill');
  });

  it('reports none, naming the fingerprint, when the video has no entries at all', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'framopia-resolve-'));
    const r = await resolveTranscriptionEntry({ videoSha256: SHA, keyterms: [], cacheRoot: root });
    expect(r.provenance).toBe('none');
    expect(r.note).toContain(r.wantedFingerprint);
  });
});

/**
 * The dry run and the runner disagreed for four blocks — one selecting by
 * prompt version, the other by computed fingerprint — and the dry run therefore
 * told the user a run was free when it would have billed. Guidelines §3: a rule
 * with more than one caller is pinned by a test, not by a comment.
 */
describe('one resolver, not two', () => {
  const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const read = (p: string): string => readFileSync(path.join(SRC, p), 'utf8');

  it('is what the runner asks', () => {
    expect(read('transcription/cached.ts')).toContain('resolveTranscriptionEntry');
  });

  it('is what the dry run asks', () => {
    expect(read('dry-run.ts')).toContain('resolveTranscriptionEntry');
  });

  it('leaves no caller selecting a transcription entry by prompt version alone', () => {
    for (const file of ['dry-run.ts', 'transcription/cached.ts', 'transcription/job.ts']) {
      expect(read(file), file).not.toContain('selectTranscriptionEntry');
    }
  });

  it('says the resolution out loud before anything is spent', () => {
    const cached = read('transcription/cached.ts');
    const noteLine = cached.indexOf('log(`cache: ${entry.note}`)');
    expect(noteLine).toBeGreaterThan(-1);
    expect(noteLine).toBeLessThan(cached.indexOf('runHybrid('));
  });

  it('resolves the guide the fingerprint is built from, not a hardcoded version', async () => {
    const guide = readFileSync(path.join(DOCS_DIR, 'ORTHOGRAPHY_GUIDE.md'), 'utf8');
    expect(guide.split('\n', 1)[0]).toContain(`v${await readGuideVersion()}`);
  });
});

/**
 * The resolver lists entries by reading their manifests, so a corrupt one is
 * invisible to it. Reporting a damaged entry as an absent one would send a
 * caller to the API with no explanation, which is the failure this whole
 * session exists to remove.
 */
describe('a corrupt entry', () => {
  it('is skipped by the resolver, which is why the runner still reads the exact directory', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'framopia-resolve-'));
    const guide = await readGuideVersion();
    const fingerprint = await fingerprintAt(guide, ACTIVE_PROMPT_VERSION);
    const dir = path.join(root, SHA, `transcription-${fingerprint}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'manifest.json'), '{ not json', 'utf8');

    const r = await resolveTranscriptionEntry({ videoSha256: SHA, keyterms: [], cacheRoot: root });
    expect(r.provenance).toBe('none');

    const cached = readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), 'cached.ts'),
      'utf8',
    );
    expect(cached).toContain('existsSync(ref.dir)');
  });
});
