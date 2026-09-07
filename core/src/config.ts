import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { LOCAL_DIR, REPO_ROOT } from './paths.js';

export interface FramopiaConfig {
  elevenLabsApiKey: string;
  googleApiKey: string;
  machineLabel: string;
}

const REQUIRED_FIELDS = ['elevenLabsApiKey', 'googleApiKey', 'machineLabel'] as const;

export const CONFIG_PATH = path.join(LOCAL_DIR, 'config.json');

export class ConfigError extends Error {}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * The example's own value for a field, or null when the example cannot be read.
 *
 * **Read out of `config.example.json` itself, never listed here.** Session 56
 * made the doctor do it this way after a hand-written rule about what a key
 * looks like refused Mohamed's real one. A list of placeholders in this file
 * would be a second copy that drifts; the example is the only place they are
 * written down, and it is what the person was told to copy.
 *
 * A missing or unreadable example makes this silently pass, which is the right
 * way round: refusing to start because a documentation file is absent would be
 * refusing for the wrong reason.
 */
function examplePlaceholder(field: string): string | null {
  const example = path.join(REPO_ROOT, 'config.example.json');
  if (!existsSync(example)) return null;
  try {
    const parsed = JSON.parse(readFileSync(example, 'utf8')) as Record<string, unknown>;
    const value = parsed[field];
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

export function loadConfig(configPath = CONFIG_PATH): FramopiaConfig {
  let raw: string;
  try {
    raw = readFileSync(configPath, 'utf8');
  } catch {
    throw new ConfigError(
      `Config file not found at ${configPath}. Create it with: ${REQUIRED_FIELDS.join(', ')}.`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ConfigError(`Config file at ${configPath} is not valid JSON.`);
  }

  const record = (parsed ?? {}) as Record<string, unknown>;
  const missing = REQUIRED_FIELDS.filter((field) => !isNonEmptyString(record[field]));

  if (missing.length > 0) {
    throw new ConfigError(
      `Config at ${configPath} is missing or has empty fields: ${missing.join(', ')}.`,
    );
  }

  /*
   * **The example's values are not keys, and starting with them wastes a run.**
   * Until Block 11 session 66 they were accepted: they are non-empty strings, so
   * every check above passed, the service started normally, the panel showed
   * work under way, and the first paid call failed with whatever the provider
   * says to a bad key. Only `npm run doctor` knew, and a partner who skips it
   * has no way to find out until then.
   *
   * Compared against the example, never validated by using them: checking a key
   * by spending money to see whether it works is not a check this project makes.
   */
  const stillTheExample = (['elevenLabsApiKey', 'googleApiKey'] as const).filter((field) => {
    const placeholder = examplePlaceholder(field);
    return placeholder !== null && record[field] === placeholder;
  });
  if (stillTheExample.length > 0) {
    throw new ConfigError(
      `The settings file at ${configPath} still holds the example's own values for ` +
        `${stillTheExample.join(' and ')}. Those are examples of what a key looks like, not ` +
        `keys — nothing will work until they are replaced with your own. Open that file and ` +
        `put your keys in.`,
    );
  }

  const config = record as unknown as FramopiaConfig;

  if (!config.elevenLabsApiKey.startsWith('sk_')) {
    console.warn('elevenLabsApiKey does not start with the expected "sk_" prefix.');
  }
  if (!config.googleApiKey.startsWith('AIza') && !config.googleApiKey.startsWith('AQ.')) {
    console.warn('googleApiKey does not match a known Google key prefix (AIza / AQ.).');
  }

  return config;
}
