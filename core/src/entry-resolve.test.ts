import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DOCS_DIR } from './paths.js';
import {
  GUIDE_VERSION_HISTORY,
  compareGuideVersions,
  recoverGuideVersion,
  resolveCacheEntry,
} from './entry-resolve.js';
import type { CachedEntryDescriptor } from './cache-select.js';

/**
 * A fingerprint stand-in with the one property the real one has: it is a pure
 * function of the configuration, so an entry's guide version is recoverable
 * from its own name. Using the real sha256 here would test node's crypto.
 */
const fingerprintFor = (promptVersion: number, guideVersion: string): string =>
  `p${promptVersion}g${guideVersion}`;

const entry = (promptVersion: number, guideVersion: string): CachedEntryDescriptor => ({
  id: `transcription-${fingerprintFor(promptVersion, guideVersion)}`,
  dir: `/cache/transcription-${fingerprintFor(promptVersion, guideVersion)}`,
  promptVersion,
});

const resolve = (entries: CachedEntryDescriptor[], guide = '1.0.8', prompt = 4) =>
  resolveCacheEntry({
    entries,
    wantedFingerprint: fingerprintFor(prompt, guide),
    wantedGuideVersion: guide,
    wantedPromptVersion: prompt,
    fingerprintFor,
  });

describe('resolveCacheEntry', () => {
  it('reports exact when the computed fingerprint is on disk', () => {
    const r = resolve([entry(4, '1.0.8')]);
    expect(r.provenance).toBe('exact');
    expect(r.id).toBe('transcription-p4g1.0.8');
    expect(r.entryGuideVersion).toBe('1.0.8');
  });

  it('reports compatible for an older guide at the same prompt version', () => {
    const r = resolve([entry(4, '1.0.7')]);
    expect(r.provenance).toBe('compatible');
    expect(r.id).toBe('transcription-p4g1.0.7');
    expect(r.entryGuideVersion).toBe('1.0.7');
  });

  it('says in words that it is reusing an older guide and will not bill', () => {
    const r = resolve([entry(4, '1.0.7')]);
    expect(r.note).toContain('v1.0.7');
    expect(r.note).toContain('v1.0.8');
    expect(r.note).toContain('will not bill');
  });

  it('takes the newest compatible entry when several are on disk', () => {
    const r = resolve([entry(4, '1.0.5'), entry(4, '1.0.7'), entry(4, '1.0.6')]);
    expect(r.entryGuideVersion).toBe('1.0.7');
  });

  it('reports none for a different prompt version, however close the guide', () => {
    const r = resolve([entry(3, '1.0.8'), entry(1, '1.0.7')]);
    expect(r.provenance).toBe('none');
    expect(r.id).toBeNull();
  });

  it('reports none for a newer guide, which is not a reuse but a mismatch', () => {
    const r = resolve([entry(4, '1.0.8')], '1.0.7');
    expect(r.provenance).toBe('none');
  });

  it('reports none with nothing on disk, and names the fingerprint it wanted', () => {
    const r = resolve([]);
    expect(r.provenance).toBe('none');
    expect(r.note).toContain('p4g1.0.8');
    expect(r.note).toContain('bill');
  });

  it('never reports compatible for an entry whose guide cannot be recovered', () => {
    const stranger: CachedEntryDescriptor = {
      id: 'transcription-somethingelse',
      dir: '/cache/transcription-somethingelse',
      promptVersion: 4,
    };
    expect(recoverGuideVersion(stranger, fingerprintFor)).toBeNull();
    expect(resolve([stranger]).provenance).toBe('none');
  });
});

describe('compareGuideVersions', () => {
  it('orders by component, not lexically', () => {
    expect(compareGuideVersions('1.0.9', '1.0.10')).toBeLessThan(0);
    expect(compareGuideVersions('1.0.7', '1.0.7')).toBe(0);
  });
});

describe('GUIDE_VERSION_HISTORY', () => {
  /**
   * The list is what a compatible reuse is searched over, so a guide version
   * missing from it resolves `none` and sends a caller to the API. The guide's
   * own status line is the source of truth for which versions have existed.
   */
  it('holds every version the orthography guide names', () => {
    const guide = readFileSync(path.join(DOCS_DIR, 'ORTHOGRAPHY_GUIDE.md'), 'utf8');
    const named = new Set(
      [...guide.slice(0, 4000).matchAll(/v(\d+\.\d+\.\d+)/g)].map((m) => m[1] as string),
    );
    for (const version of named) {
      expect(GUIDE_VERSION_HISTORY, `guide names v${version}`).toContain(version);
    }
  });

  it('is ordered oldest first', () => {
    const sorted = [...GUIDE_VERSION_HISTORY].sort(compareGuideVersions);
    expect([...GUIDE_VERSION_HISTORY]).toEqual(sorted);
  });
});
