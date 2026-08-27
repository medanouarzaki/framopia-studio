import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ACTIVE_PROMPT_VERSION } from './prompt-version.js';
import {
  CacheEntrySelectionError,
  describeSelection,
  listTranscriptionEntries,
  selectTranscriptionEntry,
  type CachedEntryDescriptor,
} from './cache-select.js';

const entry = (id: string, promptVersion: number | null): CachedEntryDescriptor => ({
  id,
  dir: `/cache/${id}`,
  promptVersion,
});

const v1 = entry('transcription-0cb5401192dbfbc7', 1);
const v3 = entry('transcription-92adf5b1bf24601a', 3);
const v4 = entry('transcription-758a3924d090d1b5', 4);

describe('selectTranscriptionEntry', () => {
  it('takes the entry at the pinned prompt version', () => {
    expect(selectTranscriptionEntry([v1, v3, v4], 'vitasilk', { pinnedPromptVersion: 4 })).toBe(v4);
  });

  /*
   * The defect this rule exists for: `readdir` returned `0cb5…` first on this
   * volume, so three diagnostics read prompt v1 on vitasilk and the pinned v4
   * on every other reel. Order must not be able to change the answer.
   */
  it('is unmoved by the order the listing arrives in', () => {
    const forward = selectTranscriptionEntry([v1, v3, v4], 'vitasilk', { pinnedPromptVersion: 4 });
    const reversed = selectTranscriptionEntry([v4, v3, v1], 'vitasilk', { pinnedPromptVersion: 4 });
    const shuffled = selectTranscriptionEntry([v3, v4, v1], 'vitasilk', { pinnedPromptVersion: 4 });

    expect(forward).toBe(v4);
    expect(reversed).toBe(v4);
    expect(shuffled).toBe(v4);
  });

  it('defaults to the version pinned in code', () => {
    expect(selectTranscriptionEntry([v1, v3, v4], 'vitasilk').promptVersion).toBe(
      ACTIVE_PROMPT_VERSION,
    );
  });

  it('fails naming the reel, the pin and everything on disk when nothing matches', () => {
    expect(() => selectTranscriptionEntry([v1, v3], 'vitasilk', { pinnedPromptVersion: 4 })).toThrow(
      CacheEntrySelectionError,
    );
    expect(() => selectTranscriptionEntry([v1, v3], 'vitasilk', { pinnedPromptVersion: 4 })).toThrow(
      /vitasilk: no cache entry at the pinned prompt version 4; on disk: transcription-0cb5401192dbfbc7 \(prompt v1\), transcription-92adf5b1bf24601a \(prompt v3\)/,
    );
  });

  it('fails rather than choosing when more than one matches', () => {
    const other = entry('transcription-ffffffffffffffff', 4);
    expect(() =>
      selectTranscriptionEntry([v4, other], 'vitasilk', { pinnedPromptVersion: 4 }),
    ).toThrow(/2 cache entries at the pinned prompt version 4/);
  });

  it('never falls back to an unversioned entry', () => {
    expect(() =>
      selectTranscriptionEntry([entry('transcription-old', null)], 'test-1', {
        pinnedPromptVersion: 4,
      }),
    ).toThrow(/prompt v\?/);
  });

  it('honours an explicit override, by full id or by fingerprint alone', () => {
    expect(
      selectTranscriptionEntry([v1, v3, v4], 'vitasilk', { entryOverride: v1.id }),
    ).toBe(v1);
    expect(
      selectTranscriptionEntry([v1, v3, v4], 'vitasilk', { entryOverride: '92adf5b1bf24601a' }),
    ).toBe(v3);
  });

  it('fails on an override that is not on disk rather than falling back to the pin', () => {
    expect(() =>
      selectTranscriptionEntry([v1, v3, v4], 'vitasilk', { entryOverride: 'deadbeef' }),
    ).toThrow(/no cache entry "deadbeef"/);
  });
});

describe('describeSelection', () => {
  it('is the one line every tool prints', () => {
    expect(describeSelection(v4)).toBe('transcription-758a3924d090d1b5 (prompt v4)');
    expect(describeSelection(entry('transcription-x', null))).toBe('transcription-x (prompt v?)');
  });
});

describe('listTranscriptionEntries', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'framopia-cache-select-'));
  const sha = 'a'.repeat(64);
  const videoDir = path.join(root, sha);

  const write = (id: string, manifest: unknown): void => {
    mkdirSync(path.join(videoDir, id), { recursive: true });
    writeFileSync(path.join(videoDir, id, 'manifest.json'), JSON.stringify(manifest));
  };

  mkdirSync(videoDir, { recursive: true });
  write('transcription-aaaa', { promptVersion: 4 });
  write('transcription-bbbb', { promptVersion: 3 });
  write('analysis-cccc', { promptVersion: 4 });
  mkdirSync(path.join(videoDir, 'transcription-nomanifest'), { recursive: true });
  mkdirSync(path.join(videoDir, 'transcription-broken'), { recursive: true });
  writeFileSync(path.join(videoDir, 'transcription-broken', 'manifest.json'), '{ not json');

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('reads only transcription entries that carry a readable manifest', () => {
    const found = listTranscriptionEntries(root, sha).map((e) => e.id).sort();
    expect(found).toEqual(['transcription-aaaa', 'transcription-bbbb']);
  });

  it('selects the pinned version out of what it found', () => {
    const chosen = selectTranscriptionEntry(listTranscriptionEntries(root, sha), 'fixture', {
      pinnedPromptVersion: 4,
    });
    expect(chosen.id).toBe('transcription-aaaa');
  });

  it('returns nothing for a video with no cache directory', () => {
    expect(listTranscriptionEntries(root, 'b'.repeat(64))).toEqual([]);
  });
});
