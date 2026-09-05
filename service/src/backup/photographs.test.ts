import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { isInClientPictureStore, modePathFor, REPO_ROOT } from '@framopia/core';
import { addPicture, createClient } from '../clients/create.js';
import { surveyGroups, withoutExcluded } from './set.js';

/**
 * **The backup does not carry a client's photographs.**
 *
 * `npm run backup` copies to Google Drive, and a doctor's patient results are
 * not ours to put there — the same reason nothing sends one to an image model.
 * Mohamed ruled on 2026-09-05 that a photograph is copied into the project so a
 * client travels with the repository, and accepted that this makes **the
 * private GitHub repository the only backup a photograph has**.
 *
 * Measured rather than read: a photograph is really attached through the real
 * route, and the backup's own file selection is asked what it would copy.
 */
const dirs: string[] = [];
const made: string[] = [];
const stored: string[] = [];

afterEach(() => {
  for (const id of made.splice(0)) rmSync(modePathFor(id), { force: true });
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  for (const file of stored.splice(0)) rmSync(path.dirname(file), { recursive: true, force: true });
});

function elsewhere(name: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'framopia-backup-photo-'));
  dirs.push(dir);
  const file = path.join(dir, name);
  writeFileSync(file, 'a photograph the client gave us');
  return file;
}

const everyFile = (): string[] => surveyGroups().flatMap((g) => g.paths);

describe('what a backup would copy', () => {
  it('leaves a client’s photograph out, even though it is now in the project', () => {
    const before = everyFile();

    const { id } = createClient({ name: 'Backup Photograph Test' });
    made.push(id);
    const picture = addPicture(id, { path: elsewhere('clinic.png'), description: 'the clinic' });
    stored.push(picture.path);

    // It really is inside the project now, which is the whole point of the copy.
    expect(isInClientPictureStore(REPO_ROOT, picture.path)).toBe(true);
    expect(readFileSync(picture.path, 'utf8')).toBe('a photograph the client gave us');

    const after = everyFile();
    expect(after).not.toContain(picture.path);
    // And nothing else moved either: attaching a photograph adds nothing to the
    // backup at all.
    expect(after.length).toBe(before.length);
  });

  it('excludes the whole store, not one file', () => {
    const inStore = everyFile().filter((f) => isInClientPictureStore(REPO_ROOT, f));
    expect(inStore).toEqual([]);
  });

  /*
   * **The two tests above pass with the rule deleted.** No group walks
   * `assets/` today, so a photograph is absent by accident — and an accident is
   * not a guarantee, which is the entire reason the rule was written. Measured
   * here by handing the filter the file list a group that *did* walk the
   * repository would produce, so that deleting the rule turns this red.
   */
  it('is what keeps a photograph out when a group does walk the repository', () => {
    const { id } = createClient({ name: 'Backup Rule Load Bearing' });
    made.push(id);
    const picture = addPicture(id, { path: elsewhere('her-face.png'), description: 'her portrait' });
    stored.push(picture.path);

    const brand = path.join(REPO_ROOT, 'assets', 'brand');
    const asAGroupWouldSeeThem = [brand, picture.path];

    expect(withoutExcluded(asAGroupWouldSeeThem)).toEqual([brand]);
  });

  /* The property the ruling rests on: no photograph reaches Google Drive. */
  it('carries no still image that is not a generated picture or a cutout', () => {
    const stills = everyFile().filter((f) =>
      /\.(png|jpg|jpeg|gif|bmp|tif|tiff|psd|webp|heic)$/i.test(f),
    );
    const unexplained = stills.filter(
      (f) => !f.includes('cutout') && !f.includes(`${path.sep}cache${path.sep}`),
    );
    expect(unexplained).toEqual([]);
  });
});
