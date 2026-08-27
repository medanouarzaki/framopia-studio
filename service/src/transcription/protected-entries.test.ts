import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { protectedEntryDirs, protectedDirsFor } from './protected-entries.js';
import { evictStaleEntries, ProtectedEvictionError } from './cache.js';

const SHA = 'b'.repeat(64);

function scaffold(): { root: string; refs: string; footage: string } {
  const base = mkdtempSync(path.join(tmpdir(), 'framopia-protect-'));
  const root = path.join(base, 'cache');
  const refs = path.join(base, 'references');
  const footage = path.join(base, 'footage');
  mkdirSync(root, { recursive: true });
  mkdirSync(refs, { recursive: true });
  mkdirSync(footage, { recursive: true });
  writeFileSync(
    path.join(footage, 'vitasilk.editplan.json'),
    JSON.stringify({ source: { sha256: SHA } }),
    'utf8',
  );
  return { root, refs, footage };
}

function entry(root: string, fingerprint: string, promptVersion: number, ageS = 0): string {
  const dir = path.join(root, SHA, `transcription-${fingerprint}`);
  mkdirSync(dir, { recursive: true });
  const manifest = path.join(dir, 'manifest.json');
  writeFileSync(manifest, JSON.stringify({ promptVersion }), 'utf8');
  if (ageS > 0) {
    const when = new Date(Date.now() - ageS * 1000);
    utimesSync(manifest, when, when);
  }
  return dir;
}

function reference(refs: string, name: string, reel: string): void {
  writeFileSync(path.join(refs, name), JSON.stringify({ schemaVersion: 3, reel }), 'utf8');
}

describe('protectedEntryDirs', () => {
  it('derives the protected entry from the reference, not from a typed name', () => {
    const { root, refs, footage } = scaffold();
    const pinned = entry(root, 'pinned', 4);
    entry(root, 'older', 3);
    reference(refs, 'vitasilk.json', 'vitasilk');

    const found = protectedEntryDirs({ cacheRoot: root, referenceDir: refs, footageDir: footage });
    expect(found).toHaveLength(1);
    expect(found[0]?.dir).toBe(pinned);
    expect(found[0]?.reel).toBe('vitasilk');
    expect(found[0]?.reference).toBe('vitasilk.json');
  });

  it('protects nothing when no reference names the reel', () => {
    const { root, refs, footage } = scaffold();
    entry(root, 'pinned', 4);
    expect(protectedEntryDirs({ cacheRoot: root, referenceDir: refs, footageDir: footage })).toEqual(
      [],
    );
  });

  it('lists one entry once when two references describe the same reel', () => {
    const { root, refs, footage } = scaffold();
    entry(root, 'pinned', 4);
    reference(refs, 'vitasilk.json', 'vitasilk');
    reference(refs, 'vitasilk.rereview.json', 'vitasilk');
    expect(
      protectedEntryDirs({ cacheRoot: root, referenceDir: refs, footageDir: footage }),
    ).toHaveLength(1);
  });

  it('skips a reel whose entry cannot be resolved rather than throwing', () => {
    const { root, refs, footage } = scaffold();
    entry(root, 'older', 3);
    reference(refs, 'vitasilk.json', 'vitasilk');
    expect(protectedEntryDirs({ cacheRoot: root, referenceDir: refs, footageDir: footage })).toEqual(
      [],
    );
  });

  it('ignores a reference that does not parse', () => {
    const { root, refs, footage } = scaffold();
    entry(root, 'pinned', 4);
    writeFileSync(path.join(refs, 'broken.json'), '{ not json', 'utf8');
    expect(protectedEntryDirs({ cacheRoot: root, referenceDir: refs, footageDir: footage })).toEqual(
      [],
    );
  });
});

describe('eviction with a protected entry', () => {
  it('evicts an unprotected entry and leaves the referenced one alone', async () => {
    const { root, refs, footage } = scaffold();
    const pinned = entry(root, 'pinned', 4, 3600);
    const mid = entry(root, 'mid', 3, 60);
    const newest = entry(root, 'newest', 2, 0);
    reference(refs, 'vitasilk.json', 'vitasilk');

    const protect = protectedDirsFor(SHA, { cacheRoot: root, referenceDir: refs, footageDir: footage });
    expect(protect).toEqual([pinned]);

    // A budget of 1 over three entries: both older ones are over budget, and
    // the oldest of them is the pinned one. The unprotected one goes, the
    // referenced one stays, and the budget is still enforced.
    const removed = await evictStaleEntries(SHA, root, 1, 'transcription', protect);
    expect(removed).toEqual([mid]);
    expect(existsSync(pinned)).toBe(true);
    expect(existsSync(mid)).toBe(false);
    expect(existsSync(newest)).toBe(true);
  });

  it('deletes the pinned entry without the guard, which is what this protects against', async () => {
    const { root } = scaffold();
    const pinned = entry(root, 'pinned', 4, 3600);
    entry(root, 'mid', 3, 60);
    entry(root, 'newest', 2, 0);

    const removed = await evictStaleEntries(SHA, root, 2, 'transcription');
    expect(removed).toEqual([pinned]);
    expect(existsSync(pinned)).toBe(false);
  });

  it('fails loudly rather than evicting when everything over budget is protected', async () => {
    const { root, refs, footage } = scaffold();
    const pinned = entry(root, 'pinned', 4, 3600);
    entry(root, 'newest', 2, 0);
    reference(refs, 'vitasilk.json', 'vitasilk');
    const protect = protectedDirsFor(SHA, { cacheRoot: root, referenceDir: refs, footageDir: footage });

    await expect(evictStaleEntries(SHA, root, 1, 'transcription', protect)).rejects.toThrow(
      ProtectedEvictionError,
    );
    expect(existsSync(pinned)).toBe(true);
  });

  it('says what is protected and what to do about it', async () => {
    const { root, refs, footage } = scaffold();
    entry(root, 'pinned', 4, 3600);
    entry(root, 'newest', 2, 0);
    reference(refs, 'vitasilk.json', 'vitasilk');
    const protect = protectedDirsFor(SHA, { cacheRoot: root, referenceDir: refs, footageDir: footage });

    await expect(evictStaleEntries(SHA, root, 1, 'transcription', protect)).rejects.toThrow(
      /transcription-pinned.*Nothing was evicted/s,
    );
  });

  it('does not fire when the video is inside its budget', async () => {
    const { root, refs, footage } = scaffold();
    entry(root, 'pinned', 4);
    reference(refs, 'vitasilk.json', 'vitasilk');
    const protect = protectedDirsFor(SHA, { cacheRoot: root, referenceDir: refs, footageDir: footage });
    await expect(evictStaleEntries(SHA, root, 3, 'transcription', protect)).resolves.toEqual([]);
  });
});

/**
 * The real repo, not a fixture: the committed references must actually resolve
 * to an entry on this machine, or the guard is protecting nothing while
 * reporting success.
 */
describe('the committed references', () => {
  it('resolve to a transcription entry that exists', () => {
    const found = protectedEntryDirs();
    expect(found.length).toBeGreaterThan(0);
    for (const e of found) expect(existsSync(e.dir), e.dir).toBe(true);
  });
});
