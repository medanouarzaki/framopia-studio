import {
  EDIT_PLAN_SCHEMA_VERSION,
  PIPELINE_STAGES,
  type EditPlan,
  type PipelineStageName,
} from './types.js';

export interface PlanValidationIssue {
  /** Dotted path to the offending value, e.g. "transcript.words[3].lang". */
  path: string;
  message: string;
}

export class EditPlanValidationError extends Error {
  constructor(readonly issues: PlanValidationIssue[]) {
    super(
      `edit plan failed validation: ${issues.map((i) => `${i.path}: ${i.message}`).join('; ')}`,
    );
    this.name = 'EditPlanValidationError';
  }
}

/**
 * A schema version we do not know is a hard stop, never a best-effort read: a
 * newer plan may carry fields whose absence here would look like deliberate
 * nulls, and writing it back would silently drop them.
 */
export class EditPlanVersionError extends Error {
  constructor(
    readonly found: unknown,
    readonly expected: number = EDIT_PLAN_SCHEMA_VERSION,
  ) {
    super(
      `edit plan schemaVersion ${JSON.stringify(found)} is not supported; this build reads version ${expected}`,
    );
    this.name = 'EditPlanVersionError';
  }
}

type Rec = Record<string, unknown>;

const STATUSES = new Set(['pending', 'running', 'done', 'error']);
const LANGS = new Set(['darija', 'msa', 'fr', 'en', 'mixed']);
const SCRIPTS = new Set(['latin', 'arabic']);
const REMOVED_REASONS = new Set(['filler', 'stutter', 'falseStart']);

class Checker {
  readonly issues: PlanValidationIssue[] = [];

  fail(path: string, message: string): void {
    this.issues.push({ path, message });
  }

  object(path: string, value: unknown): Rec | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      this.fail(path, 'expected an object');
      return null;
    }
    return value as Rec;
  }

  array(path: string, value: unknown): unknown[] | null {
    if (!Array.isArray(value)) {
      this.fail(path, 'expected an array');
      return null;
    }
    return value;
  }

  string(path: string, value: unknown): void {
    if (typeof value !== 'string') this.fail(path, 'expected a string');
  }

  nullableString(path: string, value: unknown): void {
    if (value !== null && typeof value !== 'string') this.fail(path, 'expected a string or null');
  }

  number(path: string, value: unknown): void {
    if (typeof value !== 'number' || Number.isNaN(value)) this.fail(path, 'expected a number');
  }

  nullableNumber(path: string, value: unknown): void {
    if (value !== null && (typeof value !== 'number' || Number.isNaN(value))) {
      this.fail(path, 'expected a number or null');
    }
  }

  boolean(path: string, value: unknown): void {
    if (typeof value !== 'boolean') this.fail(path, 'expected a boolean');
  }

  nullableBoolean(path: string, value: unknown): void {
    if (value !== null && typeof value !== 'boolean') this.fail(path, 'expected a boolean or null');
  }

  oneOf(path: string, value: unknown, allowed: Set<string>): void {
    if (typeof value !== 'string' || !allowed.has(value)) {
      this.fail(path, `expected one of ${[...allowed].join('|')}`);
    }
  }
}

function checkPipeline(c: Checker, value: unknown): void {
  const pipeline = c.object('pipeline', value);
  if (pipeline === null) return;
  for (const name of PIPELINE_STAGES as readonly PipelineStageName[]) {
    const p = `pipeline.${name}`;
    const stage = c.object(p, pipeline[name]);
    if (stage === null) continue;
    c.oneOf(`${p}.status`, stage.status, STATUSES);
    c.nullableString(`${p}.config`, stage.config);
    c.nullableNumber(`${p}.costUsd`, stage.costUsd);
    c.nullableBoolean(`${p}.cached`, stage.cached);
    c.nullableString(`${p}.completedAt`, stage.completedAt);
    c.nullableString(`${p}.error`, stage.error);
  }
}

function checkWords(c: Checker, value: unknown): void {
  const transcript = c.object('transcript', value);
  if (transcript === null) return;
  const words = c.array('transcript.words', transcript.words);
  if (words === null) return;
  words.forEach((raw, i) => {
    const p = `transcript.words[${i}]`;
    const w = c.object(p, raw);
    if (w === null) return;
    c.string(`${p}.id`, w.id);
    c.number(`${p}.start`, w.start);
    c.number(`${p}.end`, w.end);
    if (typeof w.start === 'number' && typeof w.end === 'number' && w.end < w.start) {
      c.fail(`${p}.end`, 'ends before it starts');
    }
    c.string(`${p}.text`, w.text);
    c.string(`${p}.sourceText`, w.sourceText);
    if (w.lang !== null) c.oneOf(`${p}.lang`, w.lang, LANGS);
    c.oneOf(`${p}.script`, w.script, SCRIPTS);
    c.nullableNumber(`${p}.confidence`, w.confidence);
    c.boolean(`${p}.removed`, w.removed);
    if (w.removedReason !== null) {
      c.oneOf(`${p}.removedReason`, w.removedReason, REMOVED_REASONS);
    }
    if (w.removed === true && w.removedReason === null) {
      c.fail(`${p}.removedReason`, 'a removed word must say why');
    }
    c.boolean(`${p}.edited`, w.edited);
  });
}

function checkSubtitles(c: Checker, value: unknown, wordIds: Set<string>): void {
  const subtitles = c.object('subtitles', value);
  if (subtitles === null) return;
  const groups = c.array('subtitles.groups', subtitles.groups);
  if (groups === null) return;
  groups.forEach((raw, i) => {
    const p = `subtitles.groups[${i}]`;
    const g = c.object(p, raw);
    if (g === null) return;
    c.string(`${p}.id`, g.id);
    const ids = c.array(`${p}.wordIds`, g.wordIds);
    if (ids !== null) {
      if (ids.length === 0) c.fail(`${p}.wordIds`, 'a group must reference at least one word');
      ids.forEach((id, j) => {
        if (typeof id !== 'string') {
          c.fail(`${p}.wordIds[${j}]`, 'expected a string');
        } else if (!wordIds.has(id)) {
          c.fail(`${p}.wordIds[${j}]`, `no transcript word has id ${id}`);
        }
      });
    }
    c.number(`${p}.start`, g.start);
    c.number(`${p}.end`, g.end);
    c.nullableString(`${p}.templateId`, g.templateId);
  });
}

function checkContainers(c: Checker, plan: Rec): void {
  const keywords = c.object('keywords', plan.keywords);
  if (keywords !== null) {
    c.oneOf('keywords.mode', keywords.mode, new Set(['auto', 'propose']));
    c.array('keywords.items', keywords.items);
  }

  const images = c.object('images', plan.images);
  if (images !== null) c.array('images.slots', images.slots);

  const zones = c.object('zones', plan.zones);
  if (zones !== null) {
    c.number('zones.sampleFps', zones.sampleFps);
    c.array('zones.zones', zones.zones);
  }

  const sfx = c.object('sfx', plan.sfx);
  if (sfx !== null) c.array('sfx.events', sfx.events);

  if (plan.watermark !== null) {
    const watermark = c.object('watermark', plan.watermark);
    if (watermark !== null) {
      c.string('watermark.assetPath', watermark.assetPath);
      c.number('watermark.startS', watermark.startS);
      c.nullableNumber('watermark.durationS', watermark.durationS);
    }
  }

  const costs = c.object('costs', plan.costs);
  if (costs !== null) {
    c.number('costs.totalUsd', costs.totalUsd);
    c.object('costs.byStage', costs.byStage);
  }

  const build = c.object('build', plan.build);
  if (build !== null) {
    c.oneOf('build.status', build.status, new Set(['none', 'built', 'stale']));
    c.nullableString('build.aepPath', build.aepPath);
    c.nullableString('build.builtAt', build.builtAt);
  }
}

/**
 * Structural validation only: types, enums, required fields, and the two
 * cross-references that would otherwise produce a plan the panel cannot
 * render (group word ids, removed-without-reason). It does not check that
 * derived timings agree with their words — that is re-derivation's job.
 */
export function validateEditPlan(value: unknown): PlanValidationIssue[] {
  const c = new Checker();
  const plan = c.object('', value);
  if (plan === null) return c.issues;

  if (plan.schemaVersion !== EDIT_PLAN_SCHEMA_VERSION) {
    c.fail('schemaVersion', `expected ${EDIT_PLAN_SCHEMA_VERSION}`);
  }

  const meta = c.object('meta', plan.meta);
  if (meta !== null) {
    c.string('meta.id', meta.id);
    c.string('meta.createdAt', meta.createdAt);
    c.string('meta.updatedAt', meta.updatedAt);
    c.string('meta.appVersion', meta.appVersion);
  }

  const source = c.object('source', plan.source);
  if (source !== null) {
    c.string('source.videoPath', source.videoPath);
    c.string('source.sha256', source.sha256);
    c.number('source.durationS', source.durationS);
    c.number('source.fps', source.fps);
    c.number('source.width', source.width);
    c.number('source.height', source.height);
    c.string('source.audioPath', source.audioPath);
  }

  if (plan.clientMode !== null) {
    const mode = c.object('clientMode', plan.clientMode);
    if (mode !== null) {
      c.string('clientMode.id', mode.id);
      c.number('clientMode.version', mode.version);
      c.string('clientMode.path', mode.path);
    }
  }

  checkPipeline(c, plan.pipeline);
  checkWords(c, plan.transcript);

  const words = (plan.transcript as Rec | undefined)?.words;
  const wordIds = new Set(
    Array.isArray(words)
      ? words
          .map((w) => (typeof w === 'object' && w !== null ? (w as Rec).id : undefined))
          .filter((id): id is string => typeof id === 'string')
      : [],
  );
  checkSubtitles(c, plan.subtitles, wordIds);
  checkContainers(c, plan);

  return c.issues;
}

export function assertValidEditPlan(value: unknown): EditPlan {
  const issues = validateEditPlan(value);
  if (issues.length > 0) throw new EditPlanValidationError(issues);
  return value as EditPlan;
}
