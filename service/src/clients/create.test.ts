import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT, isInClientPictureStore, loadMode, modePathFor, validateMode } from '@framopia/core';
import { buildClient, clientIdFor, ClientWriteError, createClient } from './create.js';

/*
 * A client is a person the agency works for, not a palette. Everything except
 * the name is optional, and every blank has to take the value that was in force
 * before the field existed — or adding a field would change what an existing
 * client builds.
 */
describe('making a client', () => {
  it('needs only a name, and the rest takes what the tool already did', () => {
    const client = buildClient({ name: 'Dr Jenna' });
    expect(validateMode(client)).toEqual([]);
    expect(client.id).toBe('dr-jenna');
    expect(client.version).toBe(1);
    // Absent, so every one of these falls back to the standard value.
    expect(client.videoFolder).toBeUndefined();
    expect(client.language).toBeUndefined();
    expect(client.videoShape).toBeUndefined();
    expect(client.watermarkByDefault).toBeUndefined();
    expect(client.subtitleBaselineY).toBeUndefined();
    expect(client.pictures).toBeUndefined();
    expect(client.fonts.status).toBe('tbd');
  });

  it('keeps what he did fill in', () => {
    const client = buildClient({
      name: 'Dr Jenna',
      about: 'Dermatologist, Casablanca',
      videoFolder: '/Volumes/T7 Shield/clients/jenna',
      fonts: { latin: 'Söhne', arabic: 'Cairo' },
      language: 'french',
      videoShape: 'square',
      subtitleBaselineY: 2200,
      watermarkByDefault: false,
    });
    expect(validateMode(client)).toEqual([]);
    expect(client.about).toBe('Dermatologist, Casablanca');
    expect(client.videoFolder).toBe('/Volumes/T7 Shield/clients/jenna');
    /*
     * The chosen names go in twice on purpose. They come from After Effects'
     * own list, and After Effects rejects any font name containing a space —
     * so the name a person reads and the name a build writes are the same
     * string here, and recording only the first would leave the build to guess.
     */
    expect(client.fonts).toMatchObject({ status: 'set', latin: 'Söhne', arabic: 'Cairo' });
    expect(client.fonts).toMatchObject({
      postScriptNames: { latin: 'Söhne', arabic: 'Cairo' },
    });
    expect(client.fonts).not.toHaveProperty('emphasis');
    expect(client.language).toBe('french');
    expect(client.watermarkByDefault).toBe(false);
  });

  it('writes an empty note as nothing at all, not as an empty string', () => {
    expect(buildClient({ name: 'X', about: '   ', videoFolder: '' }).about).toBeUndefined();
    expect(buildClient({ name: 'X', videoFolder: '' }).videoFolder).toBeUndefined();
  });

  it('makes a file name out of a person’s name, accents and all', () => {
    expect(clientIdFor('Dr Jenna — Dermatologie')).toBe('dr-jenna-dermatologie');
    expect(clientIdFor('K2  Syndicalia')).toBe('k2-syndicalia');
    expect(() => clientIdFor('!!!')).toThrow(ClientWriteError);
  });

  it('refuses a name that would overwrite a client that exists', () => {
    expect(() => createClient({ name: 'K2 Syndicalia' })).toThrow(/already a client/);
    expect(existsSync(modePathFor('k2-syndicalia'))).toBe(true);
  });

  it('refuses a name with nothing in it', () => {
    expect(() => createClient({ name: '   ' })).toThrow(/needs a name/);
  });
});

/*
 * The client that exists must be untouched by all of this. If `k2-syndicalia`
 * changed, `vitasilk` would build differently, and nothing in this session is
 * allowed to do that.
 */
describe('the client that already exists', () => {
  it('loads unchanged and carries none of the client-detail fields', () => {
    const raw = readFileSync(modePathFor('k2-syndicalia'), 'utf8');
    const mode = loadMode('k2-syndicalia');
    expect(validateMode(mode)).toEqual([]);
    // v12 at Block 9 session 13 — the framing axis loses its wide value. The
    // fields listed below are a different set and are still absent.
    expect(mode.version).toBe(12);
    for (const field of [
      'videoFolder', 'logoPath', 'pictures', 'language',
      'subtitleBaselineY', 'videoShape', 'watermarkByDefault',
    ]) {
      expect(`${field}: ${String(raw.includes(`"${field}"`))}`).toBe(`${field}: false`);
    }
  });
});

/*
 * The photographs a client gives you, added while the client is being set up.
 *
 * There is no `/clients/pictures` to call yet at that point — the client file
 * does not exist — so they travel with the client. What matters is that the two
 * routes into the same field agree: the same three refusals, and the same rule
 * for numbering.
 */
describe('a client’s own photographs, given at setup', () => {
  const here = fileURLToPath(import.meta.url);

  it('numbers them the way adding one to a saved client does', () => {
    const client = buildClient({
      name: 'Dr Jenna Photos',
      pictures: [
        { path: here, description: 'the clinic exterior' },
        { path: here, description: '  the waiting room  ' },
      ],
    });
    expect(validateMode(client)).toEqual([]);
    expect(client.pictures?.map((p) => `${p.id} ${p.description}`)).toEqual([
      'pic001 the clinic exterior',
      'pic002 the waiting room',
    ]);
    /*
     * **The stored path is the copy, not the file he chose.** Mohamed's ruling
     * of 2026-09-05: attaching a photograph copies it into the project so a
     * client travels with the repository and works on any machine. This used to
     * assert the path came back unchanged, which is the behaviour the ruling
     * retired.
     */
    for (const picture of client.pictures ?? []) {
      expect(`${picture.id}: ${isInClientPictureStore(REPO_ROOT, picture.path)}`).toBe(
        `${picture.id}: true`,
      );
      expect(picture.path).not.toBe(here);
    }
    // And the original is untouched, which is the other half of the ruling.
    expect(existsSync(here)).toBe(true);
    rmSync(path.dirname(client.pictures?.[0]?.path as string), { recursive: true, force: true });
  });

  it('refuses a photograph that is not there, rather than writing a dead path', () => {
    expect(() =>
      buildClient({
        name: 'Dr Jenna Photos',
        pictures: [{ path: '/nowhere/at/all.png', description: 'the clinic' }],
      }),
    ).toThrow(ClientWriteError);
  });

  it('refuses a relative path', () => {
    expect(() =>
      buildClient({
        name: 'Dr Jenna Photos',
        pictures: [{ path: 'clinic.png', description: 'the clinic' }],
      }),
    ).toThrow(ClientWriteError);
  });

  it('refuses one with no description, because nothing else tells them apart', () => {
    expect(() =>
      buildClient({ name: 'Dr Jenna Photos', pictures: [{ path: here, description: '   ' }] }),
    ).toThrow(ClientWriteError);
  });
});
