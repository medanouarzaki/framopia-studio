import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { modelConfig } from '@framopia/core';
import { ACTIVE_PROMPT_VERSION, ORTHOGRAPHY_GUIDE_PATH, type PromptVersion } from './correction.js';
import { SCRIBE_MODEL_ID } from './scribe.js';

/** Matches the version header of docs/ORTHOGRAPHY_GUIDE.md. */
const GUIDE_VERSION_RE = /\(v(\d+\.\d+\.\d+)\)/;

/**
 * Read from the file rather than hardcoded, so a guide bump invalidates the
 * cache on its own. A guide whose header cannot be parsed hashes its whole
 * content instead: unreadable provenance must still miss when the text
 * changes, and must never silently reuse an entry built from other rules.
 */
export async function readGuideVersion(guidePath = ORTHOGRAPHY_GUIDE_PATH): Promise<string> {
  const text = await readFile(guidePath, 'utf8');
  const header = text.split('\n', 1)[0] ?? '';
  const match = GUIDE_VERSION_RE.exec(header);
  if (match?.[1] !== undefined) return match[1];
  return `sha256:${createHash('sha256').update(text).digest('hex').slice(0, 16)}`;
}

export interface FingerprintInputs {
  promptVersion: PromptVersion;
  geminiModel: string;
  guideVersion: string;
  scribeModel: string;
  /** Keyterms change what Scribe hears and what the prompt says, so they key too. */
  keyterms: string[];
}

export async function transcriptionFingerprintInputs(options: {
  promptVersion?: PromptVersion;
  guidePath?: string;
  keyterms?: string[];
} = {}): Promise<FingerprintInputs> {
  return {
    promptVersion: options.promptVersion ?? ACTIVE_PROMPT_VERSION,
    geminiModel: modelConfig.geminiModel,
    guideVersion: await readGuideVersion(options.guidePath),
    scribeModel: SCRIBE_MODEL_ID,
    keyterms: [...(options.keyterms ?? [])].sort(),
  };
}

/**
 * Stable across key order and across runs: the inputs are serialized in a
 * fixed field order so an identical configuration always produces the same
 * directory name.
 */
export function fingerprintOf(inputs: FingerprintInputs): string {
  const canonical = JSON.stringify([
    inputs.promptVersion,
    inputs.geminiModel,
    inputs.guideVersion,
    inputs.scribeModel,
    inputs.keyterms,
  ]);
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

export async function hashFile(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk as Buffer);
  }
  return hash.digest('hex');
}
