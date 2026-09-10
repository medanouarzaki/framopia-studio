import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
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

/**
 * **Videos anywhere inside the declared folder, however deep.**
 *
 * Session 79 told Mohamed to declare the client root, so the wrong-client rule
 * could resolve both of Dr Loubna Kfafi's videos. The list then looked only in
 * that folder and told him there were no videos in it, while 25 of hers sat two,
 * three and four levels down. One declaration has to serve both rules.
 *
 * Every tree here is the test's own, built in a scratch directory.
 */
describe('videos inside the subfolders', () => {
  let tree: string;

  beforeEach(() => {
    tree = mkdtempSync(path.join(tmpdir(), 'framopia-deep-'));
  });

  afterEach(() => {
    /* Anything the test locked has to be openable again or it cannot be removed. */
    for (const dir of ['locked']) {
      try {
        chmodSync(path.join(tree, dir), 0o755);
      } catch {
        continue;
      }
    }
    rmSync(tree, { recursive: true, force: true });
  });

  function video(relative: string, bytes = 'x'): void {
    const full = path.join(tree, relative);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, bytes);
  }

  it('finds one several levels down, and says where it was', () => {
    video('September Content/Footage/Video/MVI_9499.MP4');
    const found = listFolder(tree).videos;
    expect(found).toHaveLength(1);
    expect(found[0]?.label).toBe('MVI_9499');
    expect(found[0]?.where).toBe(path.join('September Content', 'Footage', 'Video'));
  });

  it('finds them at every depth at once, shallowest first', () => {
    video('top.mov');
    video('one/a.mov');
    video('one/two/three/four/five/deep.mov');
    expect(listFolder(tree).videos.map((v) => v.label)).toEqual(['top', 'a', 'deep']);
  });

  /*
   * Three of Dr Loubna Kfafi's files are called `sora.mov`. A filename collision
   * has cost this project three sessions and $1.01; the label carries the folder
   * so the picker cannot resolve the wrong one.
   */
  it('keeps videos of the same name in different folders apart', () => {
    video('Inputs/Footages/sora.mov');
    video('August/Work in Progress/sora.mov');
    video('September/Work in Progress/sora.mov');
    const found = listFolder(tree).videos;
    expect(found).toHaveLength(3);
    expect(new Set(found.map((v) => v.where)).size).toBe(3);
    expect(new Set(found.map((v) => v.path)).size).toBe(3);
  });

  /** One folder he cannot open must not cost him the videos everywhere else. */
  it('lists the rest when a folder cannot be read, and names the one it could not', () => {
    video('open/fine.mov');
    video('locked/inner/behind.mov');
    chmodSync(path.join(tree, 'locked'), 0o000);
    const listing = listFolder(tree);
    expect(listing.videos.map((v) => v.label)).toEqual(['fine']);
    expect(listing.skipped).toContainEqual({ name: 'locked', why: 'this folder could not be read' });
  });

  /* A package is one opaque thing, not a place he keeps footage. */
  it('does not walk into an editing library or an application', () => {
    video('Library.fcpbundle/Media/inside.mov');
    video('Something.app/Contents/clip.mov');
    video('real/keeper.mov');
    expect(listFolder(tree).videos.map((v) => v.label)).toEqual(['keeper']);
  });

  it('still ignores hidden folders and hidden files', () => {
    video('.hidden/secret.mov');
    video('shown/seen.mov');
    expect(listFolder(tree).videos.map((v) => v.label)).toEqual(['seen']);
  });

  /* A link is the one way a tree of folders can be a circle. */
  it('does not follow a link that points back up the tree', () => {
    video('real/keeper.mov');
    symlinkSync(tree, path.join(tree, 'real', 'loop'), 'dir');
    const listing = listFolder(tree);
    expect(listing.videos.map((v) => v.label)).toEqual(['keeper']);
  });

  it('says there is nothing in it or in any folder inside it', () => {
    mkdirSync(path.join(tree, 'empty', 'deeper'), { recursive: true });
    expect(listFolder(tree).trouble).toBe(
      `There are no videos in ${tree}, or in any folder inside it.`,
    );
  });

  /* Empty and unopenable files are still named rather than silently dropped. */
  it('still names a file it will not offer', () => {
    video('deep/inside/nothing.mov', '');
    expect(listFolder(tree).skipped).toContainEqual({
      name: 'nothing.mov',
      why: 'the file is empty',
    });
  });
});

/**
 * **What is worth putting under the picker, and what is noise.**
 *
 * Block 12 session 84: Mohamed picked a video, the run refused, and the reason
 * was under eleven red lines saying his own After Effects projects could not be
 * opened. They were never going to be — an editing project is not a video anyone
 * would expect this tool to offer — and saying so about each one buried the
 * thing that had actually broken.
 *
 * The line between them: a file he might reasonably have expected in the list is
 * named; a file that was never a video is not. **Nothing unreadable is hidden.**
 */
describe('what is said about the files that are not offered', () => {
  let tree: string;

  beforeEach(() => {
    tree = mkdtempSync(path.join(tmpdir(), 'framopia-noise-'));
  });

  afterEach(() => {
    try {
      chmodSync(path.join(tree, 'locked'), 0o755);
    } catch {
      /* only some of these lock a folder */
    }
    rmSync(tree, { recursive: true, force: true });
  });

  function file(relative: string, bytes = 'x'): void {
    const full = path.join(tree, relative);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, bytes);
  }

  it('says nothing about an editing project sitting beside the footage', () => {
    file('reel.mov');
    file('Loubna current.aep');
    file('Loubna current auto-save 1.aep');
    file('a cut.prproj');
    const listing = listFolder(tree);
    expect(listing.videos.map((v) => v.label)).toEqual(['reel']);
    expect(listing.skipped).toEqual([]);
  });

  /* A video he can see in the folder and not in the list is one he goes hunting for. */
  it('still names a video in a format this tool will not open', () => {
    file('clip.webm');
    expect(listFolder(tree).skipped).toEqual([
      { name: 'clip.webm', why: 'this tool does not open .webm files' },
    ]);
  });

  it('still names a file it could not read, and an empty one', () => {
    file('empty.mov', '');
    expect(listFolder(tree).skipped).toContainEqual({
      name: 'empty.mov',
      why: 'the file is empty',
    });
  });

  it('still names a folder it could not open', () => {
    file('open/fine.mov');
    file('locked/inner/hidden.mov');
    chmodSync(path.join(tree, 'locked'), 0o000);
    const listing = listFolder(tree);
    expect(listing.videos.map((v) => v.label)).toEqual(['fine']);
    expect(listing.skipped).toContainEqual({
      name: 'locked',
      why: 'this folder could not be read',
    });
  });
});
