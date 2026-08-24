import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { GroundTruth, GroundTruthWord } from './types.js';

export class GroundTruthError extends Error {}

function isGroundTruthWord(value: unknown): value is GroundTruthWord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.text === 'string' &&
    (record.lang === 'darija' ||
      record.lang === 'fr' ||
      record.lang === 'en' ||
      record.lang === 'msa') &&
    (record.script === 'latin' || record.script === 'arabic')
  );
}

export function parseGroundTruthJson(raw: string): GroundTruth {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new GroundTruthError('Ground truth is not valid JSON.');
  }

  const record = parsed as Record<string, unknown>;
  if (!Array.isArray(record.words) || !record.words.every(isGroundTruthWord)) {
    throw new GroundTruthError(
      'Ground truth must be { words: [{ text, lang, script }] }.',
    );
  }

  return typeof record.version === 'string'
    ? { version: record.version, words: record.words }
    : { words: record.words };
}

/**
 * Converts a plain-text source (one utterance per line) into ground truth
 * shape for later manual lang/script tagging. Every word defaults to
 * darija/latin, the most common case in a Darija-majority reel. `#` lines
 * are instructions to the human writing the transcript, not content.
 */
export function convertPlainTextToGroundTruth(text: string): GroundTruth {
  const words: GroundTruthWord[] = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .flatMap((line) => line.split(/\s+/))
    .map((token) => ({ text: token, lang: 'darija', script: 'latin' }));

  return { words };
}

export function loadGroundTruth(filePath: string): GroundTruth {
  const raw = readFileSync(filePath, 'utf8');
  if (path.extname(filePath) === '.json') {
    return parseGroundTruthJson(raw);
  }
  return convertPlainTextToGroundTruth(raw);
}
