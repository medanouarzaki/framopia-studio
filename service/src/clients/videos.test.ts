import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { listFolder, VIDEO_EXTENSIONS } from './videos.js';
import { modePathFor } from '@framopia/core';
import { listVideosFor } from '../catalogue.js';

const folderWith = (files: Record<string, string>): string => {
  const dir = mkdtempSync(path.join(tmpdir(), 'framopia-videos-'));
  for (const [name, content] of Object.entries(files)) writeFileSync(path.join(dir, name), content);
  return dir;
};

describe('a client’s videos', () => {
  it('lists what is in the folder, by name', () => {
    const dir = folderWith({ 'b clip.mov': 'x', 'a clip.mp4': 'x', 'notes.txt': 'x' });
    const listing = listFolder(dir);
    expect(listing.videos.map((v) => v.label)).toEqual(['a clip', 'b clip']);
    expect(listing.trouble).toBeNull();
  });

  /*
   * A file that vanishes from a list is a file he goes looking for, so anything
   * that looks like video and is not offered says why.
   */
  it('says why a file it cannot use is not there, rather than hiding it', () => {
    const dir = folderWith({ 'good.mov': 'x', 'old.wmv': 'x', 'empty.mp4': '' });
    const listing = listFolder(dir);
    expect(listing.videos.map((v) => v.label)).toEqual(['good']);
    expect(listing.skipped).toEqual([
      { name: 'empty.mp4', why: 'the file is empty' },
      { name: 'old.wmv', why: 'this tool does not open .wmv files' },
    ]);
  });

  /* An unplugged disk is the common case, not a fault. */
  it('reads a missing folder as a disk that is not there', () => {
    const listing = listFolder('/Volumes/Nowhere/clients/jenna');
    expect(listing.videos).toEqual([]);
    expect(listing.trouble).toContain('is not there');
    expect(listing.trouble).toContain('plug it in and press Refresh');
  });

  it('says a folder is empty rather than saying nothing', () => {
    expect(listFolder(folderWith({})).trouble).toContain('There are no videos in');
  });

  it('opens the formats a phone and a camera produce', () => {
    expect(VIDEO_EXTENSIONS).toContain('.mov');
    expect(VIDEO_EXTENSIONS).toContain('.mp4');
  });
});

/*
 * `benchmarks/footage.json` still works. A client written before folders
 * existed — which is every client — lists exactly the five reels it always did.
 *
 * The registry of browsed videos is pointed at nothing for this, because the
 * question is about the corpus fallback and not about which videos this machine
 * happens to have opened. Without that the test started failing the first time
 * a real client reel was browsed, which is a test depending on the tester.
 */
describe('the videos a client without a folder gets', () => {
  /*
   * **A client of this test's own, with no folder.**
   *
   * These used to name `k2-syndicalia`, borrowing the real client as a stand-in
   * for "has declared no folder". Mohamed declared one on 2026-09-09, through
   * the panel, and both went red — for a premise about his data rather than for
   * the behaviour under test, which is unchanged and still worth pinning.
   */
  const saved = {
    registry: process.env['FRAMOPIA_VIDEO_REGISTRY'],
    modes: process.env['FRAMOPIA_MODES_DIR'],
  };
  let scratch: string;
  beforeAll(() => {
    process.env['FRAMOPIA_VIDEO_REGISTRY'] = path.join(tmpdir(), 'framopia-no-such-registry.json');
    scratch = mkdtempSync(path.join(tmpdir(), 'framopia-nofolder-'));
    const raw = JSON.parse(
      readFileSync(modePathFor('k2-syndicalia'), 'utf8'),
    ) as Record<string, unknown>;
    raw['id'] = 'a-client-with-no-folder';
    delete raw['videoFolder'];
    writeFileSync(
      path.join(scratch, 'a-client-with-no-folder.json'),
      JSON.stringify(raw, null, 2),
    );
    process.env['FRAMOPIA_MODES_DIR'] = scratch;
  });
  afterAll(() => {
    if (saved.registry === undefined) delete process.env['FRAMOPIA_VIDEO_REGISTRY'];
    else process.env['FRAMOPIA_VIDEO_REGISTRY'] = saved.registry;
    if (saved.modes === undefined) delete process.env['FRAMOPIA_MODES_DIR'];
    else process.env['FRAMOPIA_MODES_DIR'] = saved.modes;
    rmSync(scratch, { recursive: true, force: true });
  });

  it('falls back to the hand-kept list, unchanged', () => {
    const listing = listVideosFor('a-client-with-no-folder');
    expect(listing.folder).toBeNull();
    expect(listing.reels.map((r) => r.label).sort()).toEqual([
      'ground-truth', 'test-1', 'test-2', 'test-3', 'vitasilk',
    ]);
    expect(listing.reels.every((r) => r.present)).toBe(true);
  });

  it('gives the same list when no client is chosen at all', () => {
    expect(listVideosFor(null).reels.map((r) => r.label)).toEqual(
      listVideosFor('a-client-with-no-folder').reels.map((r) => r.label),
    );
  });
});
