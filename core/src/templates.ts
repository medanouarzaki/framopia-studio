import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './paths.js';
import { TEMPLATE_KINDS, TEMPLATE_PREFIXES, type TemplateKind } from './mode.js';

/**
 * # Template manifest and SFX index (schema version 1)
 *
 * The manifest is TEMPLATE_LIBRARY_GUIDE §8's schema exactly. Both files
 * carry a machine-readable `stub: true` rather than only a comment: Block 6
 * builds the real comps and records the real timings, and a renderer that
 * silently used these placeholder numbers would produce a composition whose
 * holds are guesses. `assertRenderable` is what a build stage calls to refuse.
 */
export const TEMPLATE_MANIFEST_SCHEMA_VERSION = 1;

export interface TemplateSfxBinding {
  sfxId: string;
  offsetS: number;
  gainDb: number;
}

export interface TemplateEntry {
  id: string;
  file: string;
  type: TemplateKind;
  placeholders: string[];
  introS: number;
  outroS: number;
  minHoldS: number;
  anchor: string;
  imagePresentation: 'cutout' | 'card' | null;
  sfx: TemplateSfxBinding[];
  notes: string;
}

export interface TemplateManifest {
  schemaVersion: number;
  stub: boolean;
  stubNote?: string;
  templates: TemplateEntry[];
}

export interface SfxEntry {
  id: string;
  file: string;
  defaultGainDb: number;
  notes?: string;
}

export interface SfxIndex {
  schemaVersion: number;
  stub: boolean;
  stubNote?: string;
  sfx: SfxEntry[];
}

export const TEMPLATES_DIR = path.join(REPO_ROOT, 'templates');
export const SFX_DIR = path.join(REPO_ROOT, 'assets', 'sfx');
export const TEMPLATE_MANIFEST_PATH = path.join(TEMPLATES_DIR, 'manifest.json');
export const SFX_INDEX_PATH = path.join(SFX_DIR, 'sfx.json');

export interface ManifestIssue {
  path: string;
  message: string;
}

export class TemplateManifestError extends Error {
  constructor(
    readonly manifestPath: string,
    readonly issues: ManifestIssue[],
  ) {
    super(
      `${manifestPath} failed validation: ${issues
        .map((i) => `${i.path}: ${i.message}`)
        .join('; ')}`,
    );
    this.name = 'TemplateManifestError';
  }
}

/** Thrown when a stage that renders reads a manifest still marked as a stub. */
export class StubTemplatesError extends Error {
  constructor(readonly stage: string) {
    super(
      `stage "${stage}" renders, and templates/manifest.json is still a stub — its timings ` +
        'are placeholders, not measurements. Block 6 replaces it with the real library.',
    );
    this.name = 'StubTemplatesError';
  }
}

const ANCHORS = new Set(['center', 'left', 'right', 'top', 'bottom']);
const PRESENTATIONS = new Set(['cutout', 'card']);
const TEMPLATE_ID_RE = /^[a-z][a-z0-9]*(_[a-z0-9]+)+$/;

type Rec = Record<string, unknown>;

function num(issues: ManifestIssue[], p: string, v: unknown, min = 0): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min) {
    issues.push({ path: p, message: `expected a number >= ${min}` });
    return null;
  }
  return v;
}

function str(issues: ManifestIssue[], p: string, v: unknown): string | null {
  if (typeof v !== 'string' || v.length === 0) {
    issues.push({ path: p, message: 'expected a non-empty string' });
    return null;
  }
  return v;
}

export function validateTemplateManifest(value: unknown, sfxIds: Set<string>): ManifestIssue[] {
  const issues: ManifestIssue[] = [];
  if (typeof value !== 'object' || value === null) {
    return [{ path: '', message: 'expected an object' }];
  }
  const manifest = value as Rec;
  if (manifest.schemaVersion !== TEMPLATE_MANIFEST_SCHEMA_VERSION) {
    issues.push({
      path: 'schemaVersion',
      message: `expected ${TEMPLATE_MANIFEST_SCHEMA_VERSION}, found ${JSON.stringify(manifest.schemaVersion)}`,
    });
  }
  if (typeof manifest.stub !== 'boolean') {
    issues.push({ path: 'stub', message: 'expected a boolean; a manifest must say whether it is real' });
  }
  if (!Array.isArray(manifest.templates)) {
    issues.push({ path: 'templates', message: 'expected an array' });
    return issues;
  }

  const seen = new Set<string>();
  manifest.templates.forEach((raw, i) => {
    const p = `templates[${i}]`;
    if (typeof raw !== 'object' || raw === null) {
      issues.push({ path: p, message: 'expected an object' });
      return;
    }
    const t = raw as Rec;
    const id = str(issues, `${p}.id`, t.id);
    if (id !== null) {
      if (seen.has(id)) issues.push({ path: `${p}.id`, message: `duplicate template id ${id}` });
      seen.add(id);
      if (!TEMPLATE_ID_RE.test(id)) {
        issues.push({
          path: `${p}.id`,
          message: `template id ${JSON.stringify(id)} does not match §3 naming: lowercase type_style`,
        });
      }
    }
    str(issues, `${p}.file`, t.file);
    str(issues, `${p}.anchor`, t.anchor);
    str(issues, `${p}.notes`, t.notes);

    if (!(TEMPLATE_KINDS as readonly string[]).includes(t.type as string)) {
      issues.push({ path: `${p}.type`, message: `expected one of ${TEMPLATE_KINDS.join('|')}` });
    } else if (id !== null && !id.startsWith(TEMPLATE_PREFIXES[t.type as TemplateKind])) {
      issues.push({
        path: `${p}.id`,
        message: `a ${String(t.type)} template must start with ${TEMPLATE_PREFIXES[t.type as TemplateKind]}`,
      });
    }
    if (typeof t.anchor === 'string' && !ANCHORS.has(t.anchor)) {
      issues.push({ path: `${p}.anchor`, message: `expected one of ${[...ANCHORS].join('|')}` });
    }

    if (!Array.isArray(t.placeholders) || t.placeholders.length === 0) {
      issues.push({ path: `${p}.placeholders`, message: 'expected at least one layer name' });
    }
    num(issues, `${p}.introS`, t.introS);
    num(issues, `${p}.outroS`, t.outroS);
    num(issues, `${p}.minHoldS`, t.minHoldS);

    if (t.type === 'image') {
      if (!PRESENTATIONS.has(t.imagePresentation as string)) {
        issues.push({
          path: `${p}.imagePresentation`,
          message: `an image template must declare ${[...PRESENTATIONS].join(' or ')}`,
        });
      }
    } else if (t.imagePresentation !== null) {
      issues.push({
        path: `${p}.imagePresentation`,
        message: 'only an image template may declare a presentation',
      });
    }

    if (!Array.isArray(t.sfx)) {
      issues.push({ path: `${p}.sfx`, message: 'expected an array' });
      return;
    }
    t.sfx.forEach((rawBinding, j) => {
      const bp = `${p}.sfx[${j}]`;
      if (typeof rawBinding !== 'object' || rawBinding === null) {
        issues.push({ path: bp, message: 'expected an object' });
        return;
      }
      const binding = rawBinding as Rec;
      const sfxId = str(issues, `${bp}.sfxId`, binding.sfxId);
      if (sfxId !== null && !sfxIds.has(sfxId)) {
        issues.push({ path: `${bp}.sfxId`, message: `no sfx with id ${sfxId} in the index` });
      }
      num(issues, `${bp}.offsetS`, binding.offsetS);
      if (typeof binding.gainDb !== 'number' || !Number.isFinite(binding.gainDb)) {
        issues.push({ path: `${bp}.gainDb`, message: 'expected a number' });
      }
    });
  });

  return issues;
}

export function validateSfxIndex(value: unknown): ManifestIssue[] {
  const issues: ManifestIssue[] = [];
  if (typeof value !== 'object' || value === null) {
    return [{ path: '', message: 'expected an object' }];
  }
  const index = value as Rec;
  if (index.schemaVersion !== TEMPLATE_MANIFEST_SCHEMA_VERSION) {
    issues.push({ path: 'schemaVersion', message: `expected ${TEMPLATE_MANIFEST_SCHEMA_VERSION}` });
  }
  if (typeof index.stub !== 'boolean') {
    issues.push({ path: 'stub', message: 'expected a boolean' });
  }
  if (!Array.isArray(index.sfx)) {
    issues.push({ path: 'sfx', message: 'expected an array' });
    return issues;
  }
  const seen = new Set<string>();
  index.sfx.forEach((raw, i) => {
    const p = `sfx[${i}]`;
    if (typeof raw !== 'object' || raw === null) {
      issues.push({ path: p, message: 'expected an object' });
      return;
    }
    const entry = raw as Rec;
    const id = str(issues, `${p}.id`, entry.id);
    if (id !== null) {
      if (seen.has(id)) issues.push({ path: `${p}.id`, message: `duplicate sfx id ${id}` });
      seen.add(id);
    }
    str(issues, `${p}.file`, entry.file);
    if (typeof entry.defaultGainDb !== 'number' || !Number.isFinite(entry.defaultGainDb)) {
      issues.push({ path: `${p}.defaultGainDb`, message: 'expected a number' });
    }
  });
  return issues;
}

export function loadSfxIndex(indexPath = SFX_INDEX_PATH): SfxIndex {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(indexPath, 'utf8'));
  } catch {
    throw new TemplateManifestError(indexPath, [{ path: '', message: 'not valid JSON' }]);
  }
  const issues = validateSfxIndex(parsed);
  if (issues.length > 0) throw new TemplateManifestError(indexPath, issues);
  return parsed as SfxIndex;
}

export function loadTemplateManifest(
  manifestPath = TEMPLATE_MANIFEST_PATH,
  indexPath = SFX_INDEX_PATH,
): TemplateManifest {
  const sfxIds = new Set(loadSfxIndex(indexPath).sfx.map((s) => s.id));
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    throw new TemplateManifestError(manifestPath, [{ path: '', message: 'not valid JSON' }]);
  }
  const issues = validateTemplateManifest(parsed, sfxIds);
  if (issues.length > 0) throw new TemplateManifestError(manifestPath, issues);
  return parsed as TemplateManifest;
}

export function templatesById(manifest: TemplateManifest): Map<string, TemplateEntry> {
  return new Map(manifest.templates.map((t) => [t.id, t]));
}

/**
 * The gate a rendering stage calls. Reading a stub manifest is fine —
 * planning needs its ids and its shape — but building from one is not.
 */
export function assertRenderable(manifest: TemplateManifest, stage: string): void {
  if (manifest.stub) throw new StubTemplatesError(stage);
}
