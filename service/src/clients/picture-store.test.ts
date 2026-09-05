import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { isInClientPictureStore, loadMode, modePathFor } from '@framopia/core';
import { addPicture, createClient } from './create.js';
import { keepPicture } from './picture-store.js';

/**
 * **A photograph is copied into the project, and the original is not touched.**
 *
 * Mohamed's ruling of 2026-09-05. Session 61 gave stored paths read-time
 * re-rooting, which carries a picture already inside the project and can do
 * nothing for one on a Desktop — so the bytes come in and git carries them.
 */
const dirs: string[] = [];
const made: string[] = [];
const stored: string[] = [];

afterEach(() => {
  for (const id of made.splice(0)) rmSync(modePathFor(id), { force: true });
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  for (const file of stored.splice(0)) rmSync(path.dirname(file), { recursive: true, force: true });
});

/** A picture somewhere that is not the project — a Desktop, in effect. */
function elsewhere(name: string, bytes = 'the original bytes'): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'framopia-elsewhere-'));
  dirs.push(dir);
  const file = path.join(dir, name);
  writeFileSync(file, bytes);
  return file;
}

function scratchRepo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'framopia-store-'));
  dirs.push(dir);
  return dir;
}

describe('keeping a photograph', () => {
  it('copies it in and leaves the original exactly where it was', () => {
    const repoRoot = scratchRepo();
    const from = elsewhere('logo.png');
    const before = readFileSync(from);

    const kept = keepPicture({ owner: 'a-client', pictureId: 'pic001', from, repoRoot });

    expect(isInClientPictureStore(repoRoot, kept)).toBe(true);
    expect(readFileSync(kept).equals(before)).toBe(true);
    // Copy, never move.
    expect(readFileSync(from).equals(before)).toBe(true);
  });

  it('keeps the extension the original had', () => {
    const repoRoot = scratchRepo();
    const kept = keepPicture({
      owner: 'a-client', pictureId: 'pic001', from: elsewhere('a.JPG'), repoRoot,
    });
    expect(path.extname(kept)).toBe('.jpg');
  });

  /* Attaching the same photograph twice writes nothing and is not an error. */
  it('reuses an identical copy rather than writing again', () => {
    const repoRoot = scratchRepo();
    const from = elsewhere('same.png');
    const first = keepPicture({ owner: 'a-client', pictureId: 'pic001', from, repoRoot });
    const again = keepPicture({ owner: 'a-client', pictureId: 'pic001', from, repoRoot });
    expect(again).toBe(first);
  });

  /*
   * A picture id is unique within its owner, so this needs an id to be reused
   * after a removal. It must not overwrite the file that is already there.
   */
  it('never overwrites a different picture that already has the name', () => {
    const repoRoot = scratchRepo();
    const first = keepPicture({
      owner: 'a-client', pictureId: 'pic001', from: elsewhere('one.png', 'first bytes'), repoRoot,
    });
    const second = keepPicture({
      owner: 'a-client', pictureId: 'pic001', from: elsewhere('two.png', 'second bytes'), repoRoot,
    });

    expect(second).not.toBe(first);
    expect(readFileSync(first, 'utf8')).toBe('first bytes');
    expect(readFileSync(second, 'utf8')).toBe('second bytes');
  });

  it('cannot put two owners’ pictures in the same file', () => {
    const repoRoot = scratchRepo();
    const from = elsewhere('shared.png');
    const hers = keepPicture({ owner: 'hers', pictureId: 'pic001', from, repoRoot });
    const his = keepPicture({ owner: 'his', pictureId: 'pic001', from, repoRoot });
    expect(hers).not.toBe(his);
  });
});

describe('attaching a photograph to a client', () => {
  it('stores the copy inside the project, not the path he chose', () => {
    const { id } = createClient({ name: 'Picture Store Attach Test' });
    made.push(id);
    const from = elsewhere('desktop-logo.png');

    const picture = addPicture(id, { path: from, description: 'their logo' });
    stored.push(picture.path);

    expect(picture.path).not.toBe(from);
    expect(isInClientPictureStore(process.cwd().replace(/\/service$/, ''), picture.path)).toBe(true);
    // The client's file names the copy, and the copy has the same bytes.
    expect(loadMode(id).pictures?.[0]?.path).toBe(picture.path);
    expect(readFileSync(picture.path).equals(readFileSync(from))).toBe(true);
    // And the original is still where he left it.
    expect(readFileSync(from, 'utf8')).toBe('the original bytes');
  });

  /*
   * A photograph attached before this change names a path outside the project.
   * Nothing re-attaches it: the stored value is left alone and session 61's
   * resolver returns it unchanged, so it goes on working exactly as it did.
   */
  it('leaves a photograph attached the old way exactly as it was', () => {
    const { id } = createClient({ name: 'Picture Store Old Form Test' });
    made.push(id);
    const outside = elsewhere('attached-before.png');

    const modePath = modePathFor(id);
    const raw = JSON.parse(readFileSync(modePath, 'utf8')) as Record<string, unknown>;
    raw['pictures'] = [{ id: 'pic001', path: outside, description: 'attached the old way' }];
    writeFileSync(modePath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');

    expect(loadMode(id).pictures?.[0]?.path).toBe(outside);
    expect(readFileSync(outside, 'utf8')).toBe('the original bytes');
  });
});
