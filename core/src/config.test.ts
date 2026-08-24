import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from './config.js';

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
