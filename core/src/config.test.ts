import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from './config.js';
import { REPO_ROOT } from './paths.js';

describe('loadConfig', () => {
  let dir: string;
  let configPath: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'framopia-config-'));
    configPath = path.join(dir, 'config.json');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('throws when the file is missing', () => {
    expect(() => loadConfig(configPath)).toThrow(ConfigError);
  });

  it('throws when a field is missing', () => {
    writeFileSync(
      configPath,
      JSON.stringify({ elevenLabsApiKey: 'sk_abc', machineLabel: 'm1' }),
    );
    expect(() => loadConfig(configPath)).toThrow(/googleApiKey/);
  });

  it('throws when a field is an empty string', () => {
    writeFileSync(
      configPath,
      JSON.stringify({ elevenLabsApiKey: 'sk_abc', googleApiKey: '', machineLabel: 'm1' }),
    );
    expect(() => loadConfig(configPath)).toThrow(/googleApiKey/);
  });

  it('accepts an AQ.-prefixed Google key', () => {
    writeFileSync(
      configPath,
      JSON.stringify({
        elevenLabsApiKey: 'sk_abc',
        googleApiKey: 'AQ.abcdef123',
        machineLabel: 'm1',
      }),
    );
    const config = loadConfig(configPath);
    expect(config.googleApiKey).toBe('AQ.abcdef123');
  });

  it('accepts a valid config', () => {
    writeFileSync(
      configPath,
      JSON.stringify({
        elevenLabsApiKey: 'sk_abc',
        googleApiKey: 'AIzaXYZ',
        machineLabel: 'm1',
      }),
    );
    const config = loadConfig(configPath);
    expect(config.machineLabel).toBe('m1');
  });
});

/**
 * **The example's values are not keys.**
 *
 * They were accepted until Block 11 session 66 — non-empty strings, so every
 * check passed, the service started normally and the first paid call failed
 * with whatever the provider says to a bad key. Session 65 measured it: on a
 * fresh clone `loadConfig` reported both keys "set". Only `npm run doctor`
 * knew, and a partner who skips it finds out at the first bill.
 */
describe('a settings file that still holds the example', () => {
  const example = JSON.parse(
    readFileSync(path.join(REPO_ROOT, 'config.example.json'), 'utf8'),
  ) as Record<string, string>;

  function write(values: Record<string, unknown>): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'framopia-config-'));
    made.push(dir);
    const file = path.join(dir, 'config.json');
    writeFileSync(file, JSON.stringify(values), 'utf8');
    return file;
  }

  const made: string[] = [];
  afterEach(() => {
    for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it('is refused, naming the file and both fields', () => {
    const file = write({
      elevenLabsApiKey: example['elevenLabsApiKey'],
      googleApiKey: example['googleApiKey'],
      machineLabel: 'someones-macbook',
    });
    expect(() => loadConfig(file)).toThrow(ConfigError);
    expect(() => loadConfig(file)).toThrow(/still holds the example's own values/);
    expect(() => loadConfig(file)).toThrow(/elevenLabsApiKey and googleApiKey/);
    expect(() => loadConfig(file)).toThrow(new RegExp(file.replace(/[/\\]/g, '.')));
  });

  it('is refused when only one of them was replaced', () => {
    const file = write({
      elevenLabsApiKey: 'sk_a_real_looking_key_of_its_own',
      googleApiKey: example['googleApiKey'],
      machineLabel: 'someones-macbook',
    });
    expect(() => loadConfig(file)).toThrow(/googleApiKey/);
  });

  /*
   * The values are read out of the example rather than listed here, so a key
   * that merely looks unusual is not refused — session 56 removed exactly such
   * a hand-written rule after it rejected Mohamed's real key.
   */
  it('accepts a key that looks nothing like either example', () => {
    const file = write({
      elevenLabsApiKey: 'not-remotely-like-the-example',
      googleApiKey: 'AQ.something_else_entirely_and_long',
      machineLabel: 'someones-macbook',
    });
    expect(loadConfig(file).googleApiKey).toBe('AQ.something_else_entirely_and_long');
  });

  /* It compares strings. Nothing here may reach a network to find out. */
  it('decides without using the key for anything', () => {
    const source = readFileSync(path.join(REPO_ROOT, 'core', 'src', 'config.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    for (const forbidden of ['fetch(', 'https://', 'node:https', 'axios']) {
      expect(`${forbidden}: ${source.includes(forbidden)}`).toBe(`${forbidden}: false`);
    }
  });
});
