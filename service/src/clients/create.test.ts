import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { loadMode, modePathFor, validateMode } from '@framopia/core';
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
    expect(client.fonts).toEqual({ status: 'set', latin: 'Söhne', arabic: 'Cairo' });
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
    // v11 at Block 9 session 12 — the image-style palette and lighting
    // fragments. The fields listed below are a different set and are still
    // absent.
    expect(mode.version).toBe(11);
    for (const field of [
      'videoFolder', 'logoPath', 'pictures', 'language',
      'subtitleBaselineY', 'videoShape', 'watermarkByDefault',
    ]) {
      expect(`${field}: ${String(raw.includes(`"${field}"`))}`).toBe(`${field}: false`);
    }
  });
});
