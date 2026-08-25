import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './paths.js';

/**
 * # Client mode schema (version 1)
 *
 * A mode is a versioned JSON file under `modes/`. It carries everything that
 * varies per client and nothing that does not: subtitle position, subtitle
 * base style and the SFX set are global (PROJECT_SPEC §5) and never appear
 * here.
 *
 * ```
 * id                 kebab-case, must equal the filename stem
 * name               human-readable client name
 * version            integer >= 1, bumped on every published change
 * palette            background / primary / accent / light, each #RRGGBB
 * fonts              { status: "tbd", note } until the user supplies them,
 *                    then { status: "set", latin, arabic }
 * imageStyle         { stylePrompt: string[], negativePrompt: string[] }
 * imageVariation     { note, axes: { <axis>: string[] } }
 * allowedTemplates   { subtitle: id[], keyword: id[], image: id[] }
 * vocabulary         client terms, fed to transcription as key terms
 * note               optional free text for the humans editing the file
 * ```
 *
 * **`imageStyle.stylePrompt` never hardcodes a colour.** It references the
 * palette by role — `{{palette.background}}` and friends — and
 * `renderStylePrompt` substitutes the values at compose time, so changing a
 * palette entry changes the prompt and no code has to be touched. A fragment
 * naming a colour literally is a validation failure.
 *
 * **`imageStyle` is the invariant half of an image prompt and
 * `imageVariation` is the varying half.** Every slot in a reel gets the whole
 * of `stylePrompt`, which is what keeps the mode palette dominant across the
 * set; each slot then draws one value from each `imageVariation` axis so the
 * images read as designed rather than batched. The axes are mode data on
 * purpose: no camera-angle, framing or lighting term may be written in a
 * source file, for the same reason no colour may be.
 *
 * **An axis must vary something that survives the cutout.** When the quality
 * gate returns `cutout` the background is discarded, so variation expressed
 * as where the subject sits inside the generated frame is erased and the set
 * reads as batched exactly where cutouts work best. That is why the
 * composition axis was dropped at Block 4 session 3 in favour of camera
 * angle, framing tightness and lighting, all properties of the subject.
 *
 * **The two halves must not contradict each other.** Both reach the same
 * composed prompt, and until Block 4 session 3 nothing checked that they
 * could both be satisfied — `one subject, centred and unobstructed` shipped
 * alongside `subject off-centre with open space to one side` on every slot
 * the planner had produced. See `VARIATION_CONTRADICTIONS`.
 *
 * Which value a given slot draws is not decided here — that is composition
 * work, and it belongs to the stage that builds image slots.
 */
export const MODE_SCHEMA_VERSION = 1;

export const PALETTE_ROLES = ['background', 'primary', 'accent', 'light'] as const;
export type PaletteRole = (typeof PALETTE_ROLES)[number];

export const TEMPLATE_KINDS = ['subtitle', 'keyword', 'image'] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

/** TEMPLATE_LIBRARY_GUIDE §3: `type_style`, lowercase, underscores, no spaces. */
export const TEMPLATE_PREFIXES: Record<TemplateKind, string> = {
  subtitle: 'sub_',
  keyword: 'kw_',
  image: 'img_',
};

/** ARCHITECTURE §5.3. Global, so they live in code and not in any mode. */
export const GLOBAL_NEGATIVE_PROMPTS = ['no text', 'no watermark', 'no logo'];

export type ModeFonts =
  | { status: 'tbd'; note: string }
  | { status: 'set'; latin: string; arabic: string };

export interface ImageVariation {
  note: string;
  /** Axis name to the values a slot may draw from. Order is significant. */
  axes: Record<string, string[]>;
}

export interface ClientMode {
  id: string;
  name: string;
  version: number;
  palette: Record<PaletteRole, string>;
  fonts: ModeFonts;
  imageStyle: { stylePrompt: string[]; negativePrompt: string[] };
  imageVariation: ImageVariation;
  allowedTemplates: Record<TemplateKind, string[]>;
  vocabulary: string[];
  note?: string;
}

export interface ModeValidationIssue {
  /** Dotted path to the offending value, e.g. "allowedTemplates.image[0]". */
  path: string;
  message: string;
}

export class ModeValidationError extends Error {
  constructor(
    readonly modePath: string,
    readonly issues: ModeValidationIssue[],
  ) {
    super(
      `mode ${modePath} failed validation: ${issues
        .map((i) => `${i.path}: ${i.message}`)
        .join('; ')}`,
    );
    this.name = 'ModeValidationError';
  }
}

/**
 * Thrown when a stage that needs a real font reads a mode whose fonts are
 * still TBD. Separate from validation: a TBD mode is valid — it is what an
 * unfinished client looks like — it just cannot be built with.
 */
export class ModeFontsUnresolvedError extends Error {
  constructor(
    readonly modeId: string,
    readonly stage: string,
  ) {
    super(
      `mode ${modeId} still has fonts marked TBD, and stage "${stage}" requires a real font; ` +
        'PROJECT_SPEC §5 forbids inventing one — the user supplies them at Block 9',
    );
    this.name = 'ModeFontsUnresolvedError';
  }
}

const HEX_COLOR_RE = /^#[0-9A-F]{6}$/;
const MODE_ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const TEMPLATE_ID_RE = /^[a-z][a-z0-9]*(_[a-z0-9]+)+$/;
const COLOR_LITERAL_RE = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|hsl)a?\(/;

type Rec = Record<string, unknown>;

class Checker {
  readonly issues: ModeValidationIssue[] = [];

  fail(path: string, message: string): void {
    this.issues.push({ path, message });
  }

  required(path: string, value: unknown): boolean {
    if (value === undefined) {
      this.fail(path, 'required field is missing');
      return false;
    }
    return true;
  }

  string(path: string, value: unknown): string | null {
    if (typeof value !== 'string' || value.length === 0) {
      this.fail(path, 'expected a non-empty string');
      return null;
    }
    return value;
  }

  object(path: string, value: unknown): Rec | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      this.fail(path, 'expected an object');
      return null;
    }
    return value as Rec;
  }

  stringArray(path: string, value: unknown): string[] | null {
    if (!Array.isArray(value)) {
      this.fail(path, 'expected an array of strings');
      return null;
    }
    const bad = value.findIndex((v) => typeof v !== 'string' || v.length === 0);
    if (bad >= 0) {
      this.fail(`${path}[${bad}]`, 'expected a non-empty string');
      return null;
    }
    return value as string[];
  }
}

function validatePalette(c: Checker, value: unknown): void {
  const palette = c.object('palette', value);
  if (palette === null) return;
  for (const role of PALETTE_ROLES) {
    if (!c.required(`palette.${role}`, palette[role])) continue;
    const raw = palette[role];
    if (typeof raw !== 'string') {
      c.fail(`palette.${role}`, 'expected a string');
    } else if (!HEX_COLOR_RE.test(raw)) {
      c.fail(
        `palette.${role}`,
        `unknown color format ${JSON.stringify(raw)}; expected uppercase #RRGGBB`,
      );
    }
  }
  for (const key of Object.keys(palette)) {
    if (!(PALETTE_ROLES as readonly string[]).includes(key)) {
      c.fail(`palette.${key}`, `unknown palette role; expected one of ${PALETTE_ROLES.join(', ')}`);
    }
  }
}

function validateFonts(c: Checker, value: unknown): void {
  const fonts = c.object('fonts', value);
  if (fonts === null) return;
  if (fonts.status === 'tbd') {
    c.string('fonts.note', fonts.note);
    return;
  }
  if (fonts.status === 'set') {
    c.string('fonts.latin', fonts.latin);
    c.string('fonts.arabic', fonts.arabic);
    return;
  }
  c.fail('fonts.status', `expected "tbd" or "set", found ${JSON.stringify(fonts.status)}`);
}

function validateImageStyle(c: Checker, value: unknown): void {
  const style = c.object('imageStyle', value);
  if (style === null) return;
  const fragments = c.stringArray('imageStyle.stylePrompt', style.stylePrompt);
  if (fragments !== null) {
    if (fragments.length === 0) c.fail('imageStyle.stylePrompt', 'expected at least one fragment');
    fragments.forEach((fragment, i) => {
      if (COLOR_LITERAL_RE.test(fragment)) {
        c.fail(
          `imageStyle.stylePrompt[${i}]`,
          'names a colour literally; reference the palette as {{palette.<role>}} instead',
        );
      }
      for (const token of fragment.matchAll(/\{\{palette\.([a-zA-Z]*)\}\}/g)) {
        if (!(PALETTE_ROLES as readonly string[]).includes(token[1] as string)) {
          c.fail(
            `imageStyle.stylePrompt[${i}]`,
            `references unknown palette role ${JSON.stringify(token[1])}`,
          );
        }
      }
    });
  }
  const negatives = c.stringArray('imageStyle.negativePrompt', style.negativePrompt);
  if (negatives !== null && negatives.length === 0) {
    c.fail('imageStyle.negativePrompt', 'expected at least one fragment');
  }
}

function validateImageVariation(c: Checker, value: unknown): void {
  const variation = c.object('imageVariation', value);
  if (variation === null) return;
  c.string('imageVariation.note', variation.note);
  const axes = c.object('imageVariation.axes', variation.axes);
  if (axes === null) return;
  const names = Object.keys(axes);
  if (names.length === 0) {
    c.fail('imageVariation.axes', 'expected at least one axis');
    return;
  }
  for (const name of names) {
    const path = `imageVariation.axes.${name}`;
    const values = c.stringArray(path, axes[name]);
    if (values === null) continue;
    if (values.length < 2) {
      c.fail(path, 'expected at least two values; an axis with one value does not vary');
      continue;
    }
    if (new Set(values).size !== values.length) {
      c.fail(path, 'values must be distinct');
    }
    values.forEach((v, i) => {
      if (COLOR_LITERAL_RE.test(v)) {
        c.fail(
          `${path}[${i}]`,
          'names a colour literally; the palette is carried by imageStyle, not by an axis',
        );
      }
    });
  }
}

/**
 * Enumerated contradictions between the invariant half of a prompt and the
 * varying half. Both halves reach the same composed string, and nothing
 * checked that they could both be satisfied: Block 4 session 2 sent
 * `one subject, centred and unobstructed` and `subject off-centre with open
 * space to one side` in one prompt, and the contradiction was found by a
 * human reading it after the image came back. It had been live on every slot
 * the planner had ever produced.
 *
 * Enumerated rather than inferred. A general model of what contradicts what
 * would need to understand the prompts; this only has to catch the pairs we
 * can name, and a pair nobody named is a pair nobody was going to write.
 */
export const VARIATION_CONTRADICTIONS: {
  invariant: string;
  contradicts: string[];
  why: string;
}[] = [
  {
    invariant: 'centred',
    contradicts: [
      'off-centre', 'off centre', 'off-center', 'off center',
      'to one side', 'low in frame', 'high in frame', 'edge to edge', 'asymmetric',
    ],
    why: 'the invariant fragment places the subject centred',
  },
  {
    invariant: 'unobstructed',
    contradicts: ['obscured', 'obstructed', 'partially hidden', 'occluded', 'behind'],
    why: 'the invariant fragment requires the subject unobstructed',
  },
  {
    invariant: 'one subject',
    contradicts: ['two subjects', 'three subjects', 'multiple subjects', 'group of', 'pair of'],
    why: 'the invariant fragment allows exactly one subject',
  },
  {
    invariant: 'single clear idea',
    contradicts: ['busy', 'cluttered', 'competing', 'layered scene'],
    why: 'the invariant fragment asks for a single clear idea',
  },
  {
    invariant: 'readable at a glance',
    contradicts: ['busy', 'cluttered', 'intricate', 'dense'],
    why: 'the invariant fragment asks for readability at a glance',
  },
];

/**
 * Cross-check, so it needs both halves and cannot live inside either
 * validator. A term drawn from an axis is appended to the whole of
 * `stylePrompt`, so the two are read together by the model and have to agree.
 */
function validateVariationAgainstStyle(c: Checker, mode: Rec): void {
  const style = mode.imageStyle as { stylePrompt?: unknown } | undefined;
  const variation = mode.imageVariation as { axes?: unknown } | undefined;
  const fragments = style?.stylePrompt;
  const axes = variation?.axes;
  if (!Array.isArray(fragments) || typeof axes !== 'object' || axes === null) return;

  const invariantText = fragments
    .filter((f): f is string => typeof f === 'string')
    .join(' ')
    .toLowerCase();

  for (const [name, values] of Object.entries(axes as Record<string, unknown>)) {
    if (!Array.isArray(values)) continue;
    values.forEach((value, index) => {
      if (typeof value !== 'string') return;
      const lower = value.toLowerCase();
      for (const rule of VARIATION_CONTRADICTIONS) {
        if (!invariantText.includes(rule.invariant)) continue;
        const hit = rule.contradicts.find((term) => lower.includes(term));
        if (hit === undefined) continue;
        c.fail(
          `imageVariation.axes.${name}[${index}]`,
          `"${hit}" contradicts imageStyle.stylePrompt ("${rule.invariant}"): ${rule.why}. ` +
            'Both halves reach the same composed prompt.',
        );
      }
    });
  }
}

function validateTemplates(c: Checker, value: unknown): void {
  const templates = c.object('allowedTemplates', value);
  if (templates === null) return;
  for (const kind of TEMPLATE_KINDS) {
    const path = `allowedTemplates.${kind}`;
    if (!c.required(path, templates[kind])) continue;
    const ids = c.stringArray(path, templates[kind]);
    if (ids === null) continue;
    if (ids.length === 0) c.fail(path, 'expected at least one template id');
    const prefix = TEMPLATE_PREFIXES[kind];
    ids.forEach((id, i) => {
      if (!TEMPLATE_ID_RE.test(id)) {
        c.fail(
          `${path}[${i}]`,
          `template id ${JSON.stringify(id)} does not match TEMPLATE_LIBRARY_GUIDE §3 ` +
            'naming: lowercase type_style, underscores, no spaces',
        );
      } else if (!id.startsWith(prefix)) {
        c.fail(
          `${path}[${i}]`,
          `template id ${JSON.stringify(id)} must start with ${JSON.stringify(prefix)} for a ${kind} template`,
        );
      }
    });
  }
  for (const key of Object.keys(templates)) {
    if (!(TEMPLATE_KINDS as readonly string[]).includes(key)) {
      c.fail(
        `allowedTemplates.${key}`,
        `unknown element type; expected one of ${TEMPLATE_KINDS.join(', ')}`,
      );
    }
  }
}

export function validateMode(value: unknown): ModeValidationIssue[] {
  const c = new Checker();
  const mode = c.object('', value);
  if (mode === null) return c.issues;

  const id = c.string('id', mode.id);
  if (id !== null && !MODE_ID_RE.test(id)) {
    c.fail('id', `expected kebab-case, found ${JSON.stringify(id)}`);
  }
  c.string('name', mode.name);
  if (typeof mode.version !== 'number' || !Number.isInteger(mode.version) || mode.version < 1) {
    c.fail('version', 'expected an integer >= 1');
  }
  if (mode.note !== undefined) c.string('note', mode.note);

  for (const field of [
    'palette',
    'fonts',
    'imageStyle',
    'imageVariation',
    'allowedTemplates',
    'vocabulary',
  ]) {
    c.required(field, mode[field]);
  }
  if (mode.palette !== undefined) validatePalette(c, mode.palette);
  if (mode.fonts !== undefined) validateFonts(c, mode.fonts);
  if (mode.imageStyle !== undefined) validateImageStyle(c, mode.imageStyle);
  if (mode.imageVariation !== undefined) validateImageVariation(c, mode.imageVariation);
  validateVariationAgainstStyle(c, mode);
  if (mode.allowedTemplates !== undefined) validateTemplates(c, mode.allowedTemplates);
  if (mode.vocabulary !== undefined) c.stringArray('vocabulary', mode.vocabulary);

  return c.issues;
}

export const MODES_DIR = path.join(REPO_ROOT, 'modes');

export function modePathFor(modeId: string): string {
  return path.join(MODES_DIR, `${modeId}.json`);
}

export function parseMode(raw: string, modePath: string): ClientMode {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ModeValidationError(modePath, [{ path: '', message: 'not valid JSON' }]);
  }
  const issues = validateMode(parsed);
  if (issues.length > 0) throw new ModeValidationError(modePath, issues);

  const mode = parsed as ClientMode;
  const stem = path.basename(modePath, '.json');
  if (mode.id !== stem) {
    throw new ModeValidationError(modePath, [
      { path: 'id', message: `must equal the filename stem ${JSON.stringify(stem)}` },
    ]);
  }
  return mode;
}

export function loadMode(modeId: string): ClientMode {
  const modePath = modePathFor(modeId);
  return parseMode(readFileSync(modePath, 'utf8'), modePath);
}

/**
 * The style fragments with palette references resolved. Colours reach a
 * prompt only through here, so a palette edit is the only way to change them.
 */
export function renderStylePrompt(mode: ClientMode): string[] {
  return mode.imageStyle.stylePrompt.map((fragment) =>
    fragment.replace(
      /\{\{palette\.([a-zA-Z]+)\}\}/g,
      (_match, role: string) => mode.palette[role as PaletteRole],
    ),
  );
}

/** Mode negatives plus the global ones, deduplicated, mode first. */
export function renderNegativePrompt(mode: ClientMode): string[] {
  return [...new Set([...mode.imageStyle.negativePrompt, ...GLOBAL_NEGATIVE_PROMPTS])];
}

/**
 * Fonts for a stage that cannot proceed without them. Throws rather than
 * substituting a default: PROJECT_SPEC §5 says the user supplies K2's fonts
 * at Block 9, and a placeholder that renders would ship as if it were chosen.
 */
export function requireFonts(mode: ClientMode, stage: string): { latin: string; arabic: string } {
  if (mode.fonts.status === 'tbd') throw new ModeFontsUnresolvedError(mode.id, stage);
  return { latin: mode.fonts.latin, arabic: mode.fonts.arabic };
}
