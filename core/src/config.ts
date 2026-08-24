import { readFileSync } from 'node:fs';
import path from 'node:path';
import { LOCAL_DIR } from './paths.js';

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

  const config = record as unknown as FramopiaConfig;

  if (!config.elevenLabsApiKey.startsWith('sk_')) {
    console.warn('elevenLabsApiKey does not start with the expected "sk_" prefix.');
  }
  if (!config.googleApiKey.startsWith('AIza') && !config.googleApiKey.startsWith('AQ.')) {
    console.warn('googleApiKey does not match a known Google key prefix (AIza / AQ.).');
  }

  return config;
}
