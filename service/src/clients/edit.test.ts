import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CLIENT_PICTURE_STORE, REPO_ROOT, loadMode, modePathFor, validateMode } from '@framopia/core';
import {
  addPicture,
  buildClient,
  createClient,
  deleteClient,
  setDetails,
  setPictureLabel,
} from './create.js';

/*
 * Scratch clients, written into the real modes directory because that is the
 * only place `modePathFor` looks, and removed after every test whatever
 * happened. Names nothing else could collide with.
 */
const made: string[] = [];
const files: string[] = [];
let scratch: string | null = null;

function client(name: string, extra: Parameters<typeof buildClient>[0] = { name }): string {
  const { id } = createClient({ ...extra, name });
  made.push(id);
  return id;
}

function still(name: string): string {
  scratch ??= mkdtempSync(path.join(tmpdir(), 'framopia-edit-'));
  const file = path.join(scratch, `${name}.png`);
  writeFileSync(file, 'not really a picture');
  files.push(file);
  return file;
}

afterEach(() => {
  const kept = [...made];
  for (const id of made.splice(0)) rmSync(modePathFor(id), { force: true });
  // A client's photographs are copied into the project now, so the copies go
  // with the mode file. Built from the one declaration, never spelled out.
  for (const id of kept.splice(0))
    rmSync(path.join(REPO_ROOT, ...CLIENT_PICTURE_STORE, id), { recursive: true, force: true });
  if (scratch !== null) rmSync(scratch, { recursive: true, force: true });
  scratch = null;
});

describe('a label on a client’s picture', () => {
  it('is written when a picture is added with one', () => {
    const id = client('Edit Test Labelled');
    const picture = addPicture(id, {
      path: still('box'),
      description: 'the box',
      label: 'Botox, Sculptra',
    });
    expect(picture.label).toBe('Botox, Sculptra');
    expect(loadMode(id).pictures?.[0]?.label).toBe('Botox, Sculptra');
  });

  /*
   * Absent is what makes a picture hand-chosen only, and the validator refuses
   * a label holding no words — so an empty box must write nothing rather than
   * an empty string.
   */
  it('is absent, not empty, when nothing was typed', () => {
    const id = client('Edit Test Blank');
    expect(addPicture(id, { path: still('a'), description: 'a', label: '   ' }).label).toBeUndefined();
    expect(addPicture(id, { path: still('b'), description: 'b', label: ', , /' }).label).toBeUndefined();
    expect(validateMode(loadMode(id))).toEqual([]);
  });

  it('can be changed and cleared afterwards, without moving the picture', () => {
    const id = client('Edit Test Relabel');
    const picture = addPicture(id, { path: still('c'), description: 'c', label: 'first' });
    expect(setPictureLabel(id, picture.id, 'second').label).toBe('second');
    expect(loadMode(id).pictures?.[0]?.label).toBe('second');
    expect(setPictureLabel(id, picture.id, '').label).toBeUndefined();
    expect(loadMode(id).pictures?.[0]?.id).toBe(picture.id);
    expect(loadMode(id).pictures?.[0]?.path).toBe(picture.path);
  });

  /*
   * A label decides which picture answers a word the next time slots are
   * planned. It is not part of the look a reel pins, so offering to move every
   * reel forward because a label was corrected would be noise.
   */
  it('does not move the client’s version', () => {
    const id = client('Edit Test Version');
    const picture = addPicture(id, { path: still('d'), description: 'd' });
    const before = loadMode(id).version;
    setPictureLabel(id, picture.id, 'anything');
    expect(loadMode(id).version).toBe(before);
  });

  it('refuses a picture this client does not have', () => {
    const id = client('Edit Test Missing');
    expect(() => setPictureLabel(id, 'pic404', 'x')).toThrow(/no picture called pic404/);
  });
});

describe('the rest of a client, corrected', () => {
  it('changes only what was sent', () => {
    const id = client('Edit Test Details', {
      name: 'Edit Test Details',
      about: 'the first note',
      language: 'french',
    });
    setDetails(id, { about: 'the second note' });
    const after = loadMode(id);
    expect(after.about).toBe('the second note');
    expect(after.language).toBe('french');
    expect(after.name).toBe('Edit Test Details');
    expect(validateMode(after)).toEqual([]);
  });

  /*
   * A blank means *standard*, and an editor that saved every field on every
   * press would turn "never said" into a choice nobody made.
   */
  it('leaves a field the client never named untouched', () => {
    const id = client('Edit Test Untouched');
    setDetails(id, { about: 'only this' });
    const after = loadMode(id);
    expect(after.language).toBeUndefined();
    expect(after.videoShape).toBeUndefined();
    expect(after.watermarkByDefault).toBeUndefined();
    expect(after.subtitleBaselineY).toBeUndefined();
  });

  it('clears a field with null rather than writing an empty one', () => {
    const id = client('Edit Test Clearing', {
      name: 'Edit Test Clearing',
      about: 'a note',
      videoFolder: '/tmp/somewhere',
    });
    setDetails(id, { about: null, videoFolder: null });
    const after = loadMode(id);
    expect(after.about).toBeUndefined();
    expect(after.videoFolder).toBeUndefined();
    expect(readFileSync(modePathFor(id), 'utf8')).not.toContain('"about"');
  });

  /*
   * A reel pins a snapshot of the client and rebuilds from it forever, and
   * `snapshotIsBehind` is what offers to move a reel forward. Offering that
   * because someone fixed a folder path would be noise; not offering it after
   * the faces changed would be wrong.
   */
  it('moves the version only when the look moves', () => {
    const id = client('Edit Test Bump');
    const first = loadMode(id).version;

    setDetails(id, { videoFolder: '/tmp/elsewhere', language: 'english' });
    expect(loadMode(id).version).toBe(first);

    setDetails(id, { fonts: { latin: 'Söhne', arabic: 'Cairo', emphasis: 'Canela' } });
    expect(loadMode(id).version).toBe(first + 1);

    setDetails(id, { name: 'Edit Test Bump Renamed' });
    expect(loadMode(id).version).toBe(first + 2);

    // Sending the same faces again is not a change.
    setDetails(id, { fonts: { latin: 'Söhne', arabic: 'Cairo', emphasis: 'Canela' } });
    expect(loadMode(id).version).toBe(first + 2);
  });

  /** The id is the filename and the value on every plan; renaming is cosmetic. */
  it('never changes the id, whatever the name becomes', () => {
    const id = client('Edit Test Rename');
    setDetails(id, { name: 'Something Else Entirely' });
    expect(loadMode(id).id).toBe(id);
    expect(loadMode(id).name).toBe('Something Else Entirely');
  });

  it('gives a client all three faces, and takes them away again', () => {
    const id = client('Edit Test Faces');
    setDetails(id, { fonts: { latin: 'Söhne', arabic: 'Cairo', emphasis: 'Canela' } });
    const fonts = loadMode(id).fonts;
    expect(fonts.status).toBe('set');
    if (fonts.status !== 'set') throw new Error('unreachable');
    expect(fonts.emphasis).toBe('Canela');
    expect(fonts.postScriptNames?.emphasis).toBe('Canela');

    setDetails(id, { fonts: null });
    expect(loadMode(id).fonts.status).toBe('tbd');
  });

  it('refuses a name that is nothing, and a language it does not know', () => {
    const id = client('Edit Test Refusals');
    expect(() => setDetails(id, { name: '   ' })).toThrow(/needs a name/);
    expect(() => setDetails(id, { language: 'klingon' as never })).toThrow(/not a language/);
    expect(() => setDetails(id, { subtitleBaselineY: -4 })).toThrow(/pixels from the top/);
  });

  it('refuses a client that is not there', () => {
    expect(() => setDetails('nobody-at-all', { about: 'x' })).toThrow(/no client called/);
  });
});

describe('a client taken off the list', () => {
  it('is gone from the picker and kept on the disk', () => {
    const id = client('Edit Test Removed');
    const modePath = modePathFor(id);
    const removed = deleteClient(id);
    made.splice(made.indexOf(id), 1);

    expect(existsSync(modePath)).toBe(false);
    // Nothing a person made is thrown away by this product.
    expect(existsSync(removed.movedTo)).toBe(true);
    expect(JSON.parse(readFileSync(removed.movedTo, 'utf8')).id).toBe(id);
    rmSync(removed.movedTo, { force: true });
  });

  it('refuses a client that is not there', () => {
    expect(() => deleteClient('nobody-at-all')).toThrow(/no client called/);
  });
});
