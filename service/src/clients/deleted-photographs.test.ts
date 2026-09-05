import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CLIENT_PICTURE_STORE, REPO_ROOT, modePathFor } from '@framopia/core';
import { addPicture, createClient, deleteClient } from './create.js';

/**
 * **Taking a client off the list takes their photographs with them.**
 *
 * Since Block 11 session 62 a photograph is copied into
 * `assets/client-pictures/`, and until session 63 deleting a client moved the
 * mode file to `.local/deleted-clients/` and left the copies behind: orphaned,
 * in a tracked directory, with nothing left naming them.
 *
 * Mohamed's decision of 2026-09-06 is that they move with the mode, into the
 * same place. **Nothing is deleted** — the standing rule about a user's own
 * material — so every assertion here is about where bytes went, never about
 * bytes that stopped existing.
 */
const dirs: string[] = [];
const made: string[] = [];
const moved: string[] = [];

afterEach(() => {
  for (const id of made.splice(0)) {
    rmSync(modePathFor(id), { force: true });
    rmSync(path.join(REPO_ROOT, ...CLIENT_PICTURE_STORE, id), { recursive: true, force: true });
  }
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  for (const m of moved.splice(0)) {
    rmSync(m, { force: true });
    rmSync(m.replace(/\.json$/, ''), { recursive: true, force: true });
  }
});

function elsewhere(name: string, bytes: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'framopia-deleted-photos-'));
  dirs.push(dir);
  const file = path.join(dir, name);
  writeFileSync(file, bytes);
  return file;
}

function clientWithPhotograph(name: string, bytes: string): { id: string; stored: string } {
  const { id } = createClient({ name });
  made.push(id);
  const picture = addPicture(id, {
    path: elsewhere('her-face.png', bytes),
    description: 'her portrait',
  });
  return { id, stored: picture.path };
}

describe('a client taken off the list, with photographs of their own', () => {
  it('takes them with it, beside the client’s own file', () => {
    const { id, stored } = clientWithPhotograph('Deleted Photos Together', 'her portrait bytes');
    expect(existsSync(stored)).toBe(true);

    const removed = deleteClient(id);
    made.splice(made.indexOf(id), 1);
    moved.push(removed.movedTo);

    // The store no longer holds them, and the reply says where they went.
    expect(existsSync(path.join(REPO_ROOT, ...CLIENT_PICTURE_STORE, id))).toBe(false);
    expect(removed.photographsMovedTo).toBe(removed.movedTo.replace(/\.json$/, ''));

    /*
     * Beside the client's own file and under the same stem, so which
     * photographs belonged to whom stays obvious in the folder.
     */
    expect(path.dirname(removed.photographsMovedTo as string)).toBe(path.dirname(removed.movedTo));
  });

  it('deletes nothing: the bytes are still there, unchanged', () => {
    const { id, stored } = clientWithPhotograph('Deleted Photos Kept', 'the exact bytes she gave us');
    const before = readFileSync(stored);

    const removed = deleteClient(id);
    made.splice(made.indexOf(id), 1);
    moved.push(removed.movedTo);

    const now = path.join(removed.photographsMovedTo as string, path.basename(stored));
    expect(existsSync(now)).toBe(true);
    expect(readFileSync(now).equals(before)).toBe(true);
  });

  it('leaves a client with no photographs exactly as it was', () => {
    const { id } = createClient({ name: 'Deleted Photos None' });
    made.push(id);

    const removed = deleteClient(id);
    made.splice(made.indexOf(id), 1);
    moved.push(removed.movedTo);

    expect(removed.photographsMovedTo).toBeUndefined();
    expect(existsSync(removed.movedTo)).toBe(true);
    expect(JSON.parse(readFileSync(removed.movedTo, 'utf8')).id).toBe(id);
  });

  /*
   * The case the timestamp alone does not cover: the same id deleted twice.
   * `freeStem` claims the `.json` and the folder together, so neither deletion
   * can land on the other's name however fast they follow each other.
   */
  it('cannot collide with an earlier deletion of the same id', () => {
    const first = clientWithPhotograph('Deleted Photos Twice', 'the first client');
    const removedFirst = deleteClient(first.id);
    made.splice(made.indexOf(first.id), 1);
    moved.push(removedFirst.movedTo);

    const second = clientWithPhotograph('Deleted Photos Twice', 'the second client');
    expect(second.id).toBe(first.id);
    const removedSecond = deleteClient(second.id);
    made.splice(made.indexOf(second.id), 1);
    moved.push(removedSecond.movedTo);

    expect(removedSecond.movedTo).not.toBe(removedFirst.movedTo);
    expect(removedSecond.photographsMovedTo).not.toBe(removedFirst.photographsMovedTo);

    // And both clients' photographs survive, each saying what it said.
    const bytesOf = (at: string): string =>
      readFileSync(path.join(at, 'pic001.png'), 'utf8');
    expect(bytesOf(removedFirst.photographsMovedTo as string)).toBe('the first client');
    expect(bytesOf(removedSecond.photographsMovedTo as string)).toBe('the second client');
  });

  /*
   * **The test above passes even with the guard removed**, because two
   * deletions a few milliseconds apart get different stamps anyway. This is the
   * case that actually needs it: the clock held still, so both deletions ask
   * for the identical name and only `freeStem` keeps them apart.
   */
  it('keeps them apart even when the clock does not move', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-06T10:00:00.000Z'));
    try {
      const first = clientWithPhotograph('Deleted Photos Same Instant', 'the first client');
      const removedFirst = deleteClient(first.id);
      made.splice(made.indexOf(first.id), 1);
      moved.push(removedFirst.movedTo);

      const second = clientWithPhotograph('Deleted Photos Same Instant', 'the second client');
      const removedSecond = deleteClient(second.id);
      made.splice(made.indexOf(second.id), 1);
      moved.push(removedSecond.movedTo);

      // The same instant, so the stamp is identical and the stem is not.
      expect(removedSecond.movedTo).not.toBe(removedFirst.movedTo);
      expect(
        readFileSync(path.join(removedFirst.photographsMovedTo as string, 'pic001.png'), 'utf8'),
      ).toBe('the first client');
      expect(
        readFileSync(path.join(removedSecond.photographsMovedTo as string, 'pic001.png'), 'utf8'),
      ).toBe('the second client');
    } finally {
      vi.useRealTimers();
    }
  });
});
