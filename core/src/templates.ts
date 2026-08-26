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

/*
 * Auditing the built library against this manifest — TEMPLATE_LIBRARY_GUIDE §9.
 *
 * The audit itself is an ExtendScript run inside After Effects
 * (tools/validate-templates/audit.jsx); what lives here is the pure comparison
 * of its output against the manifest, so it can be unit tested without AE.
 */
/** The measured animation budget, docs/TEMPLATE_BUILD_SPEC.md §4. */
export const MAX_INTRO_PLUS_OUTRO_S = 0.13;

/**
 * Comps are authored at 29.97, not §3's 30: every source reel is 30000/1001.
 * The tolerance is wide enough for 29.97 and 30000/1001 to both pass and far
 * too narrow for 30 to.
 */
export const REQUIRED_FPS = 29.97;
export const FPS_TOLERANCE = 0.01;

export interface AuditLayer {
  name: string;
  kind: string;
}
export interface AuditComp {
  name: string;
  frameRate: number;
  width: number;
  height: number;
  duration: number;
  layers: AuditLayer[];
}
export interface Audit {
  ok: boolean;
  aeVersion?: string;
  aepSha256?: string;
  comps?: AuditComp[];
  error?: string;
}

/**
 * A placeholder is replaced by having its source or its text swapped, so what
 * matters is whether it can carry the content, not which of AE's classes it
 * is. A text placeholder must be a real text layer; an image placeholder must
 * be anything with a replaceable source — the built comps use solids rather
 * than the still §4 suggests, and a solid replaces exactly as well.
 */
const ACCEPTS: Record<string, { kinds: string[]; describe: string }> = {
  TXT_MAIN: { kinds: ['text'], describe: 'an editable text layer' },
  IMG_MAIN: { kinds: ['footage', 'solid'], describe: 'a footage or solid layer' },
};

export function validateTemplates(options: {
  audit: Audit;
  manifest: { stub: boolean; templates: Record<string, unknown>[] };
  sfxIds: Set<string>;
  aepSha256: string;
}): string[] {
  const { audit, manifest, sfxIds, aepSha256 } = options;
  const problems: string[] = [];

  if (!audit.ok) {
    return [`the audit of templates/library.aep failed: ${audit.error ?? 'no reason given'}`];
  }
  if (audit.aepSha256 !== aepSha256) {
    return [
      'templates/library.audit.json is stale: it was taken from a different ' +
        `templates/library.aep (audit ${String(audit.aepSha256).slice(0, 12)}, ` +
        `file ${aepSha256.slice(0, 12)}). Re-run: npm run audit:templates`,
    ];
  }

  const comps = new Map((audit.comps ?? []).map((c) => [c.name, c]));
  const declared = new Set<string>();

  for (const raw of manifest.templates) {
    const t = raw as {
      id: string;
      type: string;
      placeholders: string[];
      introS: number;
      outroS: number;
      minHoldS: number;
      sfx?: { sfxId: string }[];
    };
    declared.add(t.id);

    const comp = comps.get(t.id);
    if (comp === undefined) {
      problems.push(`manifest template "${t.id}" has no comp of that name in library.aep`);
      continue;
    }

    const expectedPrefix = TEMPLATE_PREFIXES[t.type as TemplateKind];
    if (expectedPrefix !== undefined && !t.id.startsWith(expectedPrefix)) {
      problems.push(`comp "${t.id}" is type "${t.type}" but does not start with "${expectedPrefix}"`);
    }

    for (const name of t.placeholders) {
      const layer = comp.layers.find((l) => l.name === name);
      if (layer === undefined) {
        const names = comp.layers.map((l) => l.name).join(', ') || 'none';
        problems.push(
          `comp "${t.id}" declares placeholder "${name}" but has no layer of that name ` +
            `(layers present: ${names})`,
        );
        continue;
      }
      const accepts = ACCEPTS[name];
      if (accepts !== undefined && !accepts.kinds.includes(layer.kind)) {
        problems.push(
          `comp "${t.id}" layer "${name}" is a ${layer.kind} layer; ${accepts.describe} is required`,
        );
      }
    }

    if (Math.abs(comp.frameRate - REQUIRED_FPS) > FPS_TOLERANCE) {
      problems.push(
        `comp "${t.id}" is ${comp.frameRate} fps; ${REQUIRED_FPS} is required ` +
          '(every source reel is 30000/1001)',
      );
    }

    const floor = t.introS + t.minHoldS + t.outroS;
    if (floor > comp.duration + 1e-9) {
      problems.push(
        `comp "${t.id}" is ${comp.duration.toFixed(3)}s long but its manifest timings need ` +
          `${floor.toFixed(3)}s (introS ${t.introS} + minHoldS ${t.minHoldS} + outroS ${t.outroS})`,
      );
    }

    const budget = t.introS + t.outroS;
    if (budget > MAX_INTRO_PLUS_OUTRO_S + 1e-9) {
      problems.push(
        `comp "${t.id}" spends ${budget.toFixed(3)}s on intro+outro; the measured budget is ` +
          `${MAX_INTRO_PLUS_OUTRO_S}s (introS ${t.introS} + outroS ${t.outroS}) — ` +
          'see docs/TEMPLATE_BUILD_SPEC.md §4',
      );
    }

    for (const binding of t.sfx ?? []) {
      if (!sfxIds.has(binding.sfxId)) {
        problems.push(
          `comp "${t.id}" binds sfxId "${binding.sfxId}", which assets/sfx/sfx.json does not define`,
        );
      }
    }
  }

  for (const comp of comps.values()) {
    if (!Object.values(TEMPLATE_PREFIXES).some((p) => comp.name.startsWith(p))) continue;
    if (!declared.has(comp.name)) {
      problems.push(
        `comp "${comp.name}" looks like a template but templates/manifest.json has no entry for it`,
      );
    }
  }

  return problems;
}
