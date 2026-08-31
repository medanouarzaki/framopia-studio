import { createHash } from 'node:crypto';
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
 * imageScale         optional 0.5-2.0; how much larger than the largest
 *                    face-clearing square an image is drawn. Default 1.0.
 * imageSlotsPer30s   optional 1-20; how many images a 30-second reel gets.
 *                    Default 8.
 * imageCandidates    optional 2-4; §5.4's mode override for how many
 *                    candidates a slot generates. Absent means the code
 *                    default.
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

/*
 * Declared in `palette-meaning.ts` and re-exported here, so every existing
 * importer is unchanged. That module has no imports at all, which is what lets
 * the panel read it: the barrel reaches `node:crypto` and `node:fs` through this
 * file, and esbuild cannot resolve those for a browser target — the same reason
 * `build-stamp` is its own subpath.
 */
import { PALETTE_ROLES, type PaletteRole } from './palette-meaning.js';

export { PALETTE_ROLES, type PaletteRole };

export const TEMPLATE_KINDS = ['subtitle', 'keyword', 'image'] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

/** TEMPLATE_LIBRARY_GUIDE §3: `type_style`, lowercase, underscores, no spaces. */
export const TEMPLATE_PREFIXES: Record<TemplateKind, string> = {
  subtitle: 'sub_',
  keyword: 'kw_',
  image: 'img_',
};

/**
 * ARCHITECTURE §5.3. Global, so they live in code and not in any mode.
 *
 * `no text` was removed at Block 4 session 5 by the user's ruling. It never
 * worked as a control — one of the six corpus images rendered a legible
 * product label straight through it — and the thing being guarded against was
 * uncontrolled labelling, not lettering as such. Text is now permitted and
 * checked after the fact against what the slot is supposed to depict
 * (`analysis`/OCR verdict), which is a check that can actually fail.
 *
 * `no watermark` and `no logo` stay: those are about model watermarks and
 * invented brand marks, which the ruling did not touch.
 */
export const GLOBAL_NEGATIVE_PROMPTS = ['no watermark', 'no logo'];

/**
 * The client's faces, in the same representation `LATIN_FONT` and `ARABIC_FONT`
 * already use: family and style as one human-readable string, `Inter Semi-Bold`.
 * **Not a PostScript name.** After Effects reports its own font as
 * `Inter-SemiBold` and nothing in this project has ever written
 * `TextDocument.font`, so resolving one form to the other is a measurement that
 * has to be taken inside After Effects and is not taken here.
 *
 * `emphasis` is optional. A client with two faces sets emphasized words in the
 * ordinary Latin face, which is what every build did before this field existed.
 */
export type ModeFonts =
  | { status: 'tbd'; note: string }
  | {
      status: 'set';
      latin: string;
      arabic: string;
      emphasis?: string;
      /**
       * The strings After Effects actually accepts, per role.
       *
       * **Optional with a default**: a client whose faces have not been checked
       * on a host has none, and every mode written before Block 9 session 5 is
       * that client. Absent means unresolved, which is not the same as absent
       * from the machine.
       *
       * They are PostScript names because **After Effects rejects any font name
       * containing a space** — `TextDocument.font` throws `Unable to set
       * "font". Contains invalid character 32`, measured on 26.0x67. The
       * family-and-style strings above stay: they are what the user gave, and
       * they are what a person reads.
       */
      postScriptNames?: { latin?: string; arabic?: string; emphasis?: string };
      note?: string;
    };

/**
 * Which palette role carries which kind of text.
 *
 * Optional with a default, and the default is what every build has drawn: the
 * light of the palette for ordinary words and the accent for emphasized ones.
 * Roles, never hex — no colour is ever written outside a mode's own palette,
 * and a role is what survives a palette being re-tuned.
 */
export interface ModeTextColours {
  ordinary?: PaletteRole;
  emphasis?: PaletteRole;
  /**
   * The colour of the shadow copy drawn behind a word, where a template has
   * one.
   *
   * **Absent means the build leaves the template's own colour alone**, which is
   * what it does today and what every client without this field gets. There is
   * no palette default: a shadow colour is a decision about a client's look,
   * and picking one for a client who has not made it would give them somebody
   * else's.
   *
   * Recorded and **not yet wired through to the build** — the build sets the
   * visible layer's colour and never the shadow's.
   */
  shadow?: PaletteRole;
}

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
  /** Optional; absent means light for ordinary words and accent for emphasis. */
  textColours?: ModeTextColours;
  imageStyle: { stylePrompt: string[]; negativePrompt: string[] };
  imageVariation: ImageVariation;
  /**
   * §5.4 calls the candidate count mode-overridable and nothing carried it
   * until Block 4 session 5. Optional: absent means the code default, so
   * every mode written before this stays valid.
   */
  /**
   * How many images a 30-second reel gets, for this client.
   *
   * Density is taste, and two clients will not agree about it. Absent takes the
   * default in `count.ts`, which the user set to 8 on 2026-08-29.
   */
  imageSlotsPer30s?: number;
  imageCandidates?: number;
  /**
   * How large an image is drawn, as a multiple of the largest square that
   * clears the speaker's face in the top-left corner.
   *
   * A client decision, not a geometric one: the solver's square is what fits,
   * and how much of it a client wants filled is taste. Above 1.0 the square is
   * bounded by the frame and by the face on the way out, so a value the reel
   * cannot honour is **clamped and reported**, never rendered over a face.
   * Absent means 1.0, so every existing mode keeps the size it had.
   */
  imageScale?: number;
  allowedTemplates: Record<TemplateKind, string[]>;
  vocabulary: string[];
  /**
   * **The maintainer's note, and it never reaches the screen.** It explains the
   * file to whoever edits it — "the palette is locked, vocabulary is
   * deliberately empty" — and the panel showed it under the client picker for a
   * session, which is developer prose on a motion designer's screen. What he
   * writes about a client is `about`.
   */
  note?: string;
  /**
   * One line about the client, in his words: "Dr Jenna, dermatologist,
   * Casablanca". Optional, and the only text about a client the panel shows.
   */
  about?: string;

  /*
   * Everything below is a **client detail**, added 2026-08-29 when a client
   * stopped being a palette and became a person the agency works for. All of it
   * is optional with a default, so `k2-syndicalia` loads unchanged and builds
   * the same comp: a client with nothing but a name and a folder works exactly
   * as one written before any of this existed.
   */

  /**
   * Where this client's footage lives. Absent falls back to
   * `benchmarks/footage.json`, which is how the five corpus reels still list.
   */
  videoFolder?: string;

  /** Their logo, referenced where it sits. Nothing copies it. */
  logoPath?: string;

  /**
   * Pictures the client supplied, each described in their words — "the clinic
   * exterior". They are offered in the picture editor beside the generated
   * candidates and **never sent anywhere**: a doctor's patient photograph does
   * not go to an image model. See `core/src/client-pictures.ts`.
   */
  pictures?: ClientPicture[];

  /**
   * What is mostly spoken. It reaches transcription as context and decides
   * which of the two faces carries most of the text. Absent means `mixed`,
   * which is what every reel in the corpus is.
   */
  language?: ClientLanguage;

  /**
   * The subtitle baseline, in pixels from the top of the frame. Absent means
   * the global `SUBTITLE_ANCHOR_BASELINE_Y`, which is where every build so far
   * has put it; a client with a logo bug along the bottom needs it moved.
   */
  subtitleBaselineY?: number;

  /**
   * The shape their videos are delivered in. Absent means `vertical`, which is
   * what everything built so far assumes — 2160 x 3840. **Recorded, not yet
   * acted on**: placement, watermark inset and safe width are all derived from
   * a vertical frame, and changing them is its own piece of work.
   */
  videoShape?: VideoShape;

  /**
   * Whether this client's videos carry the Framopia mark by default. Absent
   * means yes, which is what every build has done. The per-video control from
   * session 30 still overrides it either way.
   */
  watermarkByDefault?: boolean;
}

export const CLIENT_LANGUAGES = ['darija', 'french', 'english', 'mixed'] as const;
export type ClientLanguage = (typeof CLIENT_LANGUAGES)[number];

export const VIDEO_SHAPES = ['vertical', 'square', 'landscape'] as const;
export type VideoShape = (typeof VIDEO_SHAPES)[number];

/** A picture the client gave us, where they put it, in their own words. */
export interface ClientPicture {
  id: string;
  /** Absolute, and left where it is. Nothing copies it into a cache. */
  path: string;
  /** "the clinic exterior" — what he would say if you asked him what it is. */
  description: string;
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
    // Optional, and validated only when present: a client with two faces is
    // exactly what every mode written before Block 9 session 2 looks like.
    if (fonts.emphasis !== undefined) c.string('fonts.emphasis', fonts.emphasis);
    if (fonts.note !== undefined) c.string('fonts.note', fonts.note);
    if (fonts.postScriptNames !== undefined) {
      const names = c.object('fonts.postScriptNames', fonts.postScriptNames);
      if (names !== null) {
        for (const role of ['latin', 'arabic', 'emphasis']) {
          const value = names[role];
          if (value === undefined) continue;
          if (typeof value !== 'string' || value.length === 0) {
            c.fail(`fonts.postScriptNames.${role}`, 'expected a non-empty string');
            continue;
          }
          // A name with a space cannot be written to a text layer at all, so
          // recording one would record something that provably does not work.
          if (/\s/.test(value)) {
            c.fail(
              `fonts.postScriptNames.${role}`,
              'a PostScript name has no spaces; After Effects rejects one that does',
            );
          }
        }
      }
    }
    return;
  }
  c.fail('fonts.status', `expected "tbd" or "set", found ${JSON.stringify(fonts.status)}`);
}

function validateTextColours(c: Checker, value: unknown): void {
  const colours = c.object('textColours', value);
  if (colours === null) return;
  for (const key of ['ordinary', 'emphasis']) {
    const role = colours[key];
    if (role === undefined) continue;
    if (typeof role !== 'string' || !(PALETTE_ROLES as readonly string[]).includes(role)) {
      c.fail(
        `textColours.${key}`,
        `expected a palette role, one of ${PALETTE_ROLES.join(', ')}`,
      );
    }
  }
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
 * Words and shapes that mean a slot's idea depicts more than one thing.
 *
 * Enumerated, readable and extendable rather than clever, for the same reason
 * `VARIATION_CONTRADICTIONS` is: a general model of "how many things is this"
 * would need to understand the idea, while this only has to catch the phrasings
 * a planner actually writes.
 *
 * **The list is necessarily incomplete**, and a hard failure built on it will
 * miss ideas it should catch — `scientific molecular structures` is
 * multi-subject and no entry here sees it. Extending it is cheap; the entries
 * are grouped by the reason they qualify so a reader can tell what kind of
 * word belongs.
 *
 * The rule exists because `img005`'s idea — `A salon shelf displaying premium
 * hair care products` — contradicted the mode's own invariant fragment,
 * `one subject, centred and unobstructed`, and produced three distinct
 * problems at once: an `alpha_edge_noise` failure the gate reported as a matte
 * defect, 47 invented label words, and a matte nothing could use. Block 3's
 * image negatives already said *nothing in frame that is not carrying the
 * idea*; a shelf of products is the opposite of one idea read at a glance.
 */
export const MULTI_SUBJECT_MARKERS: { term: string; why: string }[] = [
  { term: 'shelf', why: 'a shelf is a container for many things' },
  { term: 'shelves', why: 'a shelf is a container for many things' },
  { term: 'display', why: 'a display is an arrangement of several items' },
  { term: 'range', why: 'a product range is a set' },
  { term: 'collection', why: 'a collection is a set' },
  { term: 'lineup', why: 'a lineup is a set' },
  { term: 'line-up', why: 'a lineup is a set' },
  { term: 'assortment', why: 'an assortment is a set' },
  { term: 'selection of', why: 'a selection is a set' },
  { term: 'array of', why: 'an array is a set' },
  { term: 'row of', why: 'a row is a set' },
  { term: 'set of', why: 'a set is a set' },
  { term: 'group of', why: 'a group is a set' },
  { term: 'variety of', why: 'a variety is a set' },
  { term: 'products', why: 'a plural product noun depicts more than one' },
  { term: 'bottles', why: 'a plural product noun depicts more than one' },
  { term: 'jars', why: 'a plural product noun depicts more than one' },
  { term: 'tubes', why: 'a plural product noun depicts more than one' },
  { term: 'containers', why: 'a plural product noun depicts more than one' },
  { term: 'packages', why: 'a plural product noun depicts more than one' },
  { term: 'items', why: 'a plural product noun depicts more than one' },
  { term: 'capsules', why: 'a plural product noun depicts more than one' },
  { term: 'sachets', why: 'a plural product noun depicts more than one' },
  { term: 'vials', why: 'a plural product noun depicts more than one' },
];

export interface IdeaIssue {
  slotId: string;
  idea: string;
  marker: string;
  message: string;
}

/**
 * Checks a slot idea against the mode's single-subject invariant.
 *
 * Returns issues rather than rewriting. **A violating idea is the planner's
 * defect**, and a silent rewrite would hide the stage that needs changing
 * behind an idea nobody wrote.
 *
 * Only applies when the mode actually asks for one subject — a mode whose
 * style fragments never say so has not made the claim, and this must not
 * invent it.
 */
export function checkSlotIdea(slotId: string, idea: string, mode: ClientMode): IdeaIssue[] {
  const invariant = mode.imageStyle.stylePrompt.join(' ').toLowerCase();
  if (!invariant.includes('one subject')) return [];

  const lower = idea.toLowerCase();
  return MULTI_SUBJECT_MARKERS.filter((m) => lower.includes(m.term)).map((m) => ({
    slotId,
    idea,
    marker: m.term,
    message:
      `"${m.term}" makes this idea multi-subject (${m.why}), and the mode's ` +
      'style prompt asks for one subject, centred and unobstructed. ' +
      'The planner must write a single-subject idea; this is not rewritten here.',
  }));
}

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
  if (mode.about !== undefined) c.string('about', mode.about);

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
  if (mode.textColours !== undefined) validateTextColours(c, mode.textColours);
  if (mode.imageStyle !== undefined) validateImageStyle(c, mode.imageStyle);
  if (mode.imageVariation !== undefined) validateImageVariation(c, mode.imageVariation);
  if (mode.imageScale !== undefined) {
    const s = mode.imageScale;
    if (typeof s !== 'number' || !Number.isFinite(s) || s < 0.5 || s > 2) {
      c.fail('imageScale', 'expected a number between 0.5 and 2.0');
    }
  }
  if (mode.imageSlotsPer30s !== undefined) {
    const n = mode.imageSlotsPer30s;
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 1 || n > 20) {
      c.fail('imageSlotsPer30s', 'expected a number between 1 and 20');
    }
  }
  if (mode.imageCandidates !== undefined) {
    const n = mode.imageCandidates;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 2 || n > 4) {
      c.fail('imageCandidates', 'expected an integer between 2 and 4 (ARCHITECTURE §5.4)');
    }
  }
  validateClientDetails(c, mode);
  validateVariationAgainstStyle(c, mode);
  if (mode.allowedTemplates !== undefined) validateTemplates(c, mode.allowedTemplates);
  if (mode.vocabulary !== undefined) c.stringArray('vocabulary', mode.vocabulary);

  return c.issues;
}

/**
 * The client details, every one optional. A mode written before any of them
 * existed passes untouched, which is the schema-fragility rule: a required
 * addition makes every plan and every mode on disk unopenable.
 */
function validateClientDetails(c: Checker, mode: Record<string, unknown>): void {
  if (mode.videoFolder !== undefined) {
    const folder = c.string('videoFolder', mode.videoFolder);
    if (folder !== null && !path.isAbsolute(folder)) {
      c.fail('videoFolder', 'expected an absolute path');
    }
  }
  if (mode.logoPath !== undefined) {
    const logo = c.string('logoPath', mode.logoPath);
    if (logo !== null && !path.isAbsolute(logo)) {
      c.fail('logoPath', 'expected an absolute path');
    }
  }
  if (mode.language !== undefined && !(CLIENT_LANGUAGES as readonly unknown[]).includes(mode.language)) {
    c.fail('language', `expected one of ${CLIENT_LANGUAGES.join(', ')}`);
  }
  if (mode.videoShape !== undefined && !(VIDEO_SHAPES as readonly unknown[]).includes(mode.videoShape)) {
    c.fail('videoShape', `expected one of ${VIDEO_SHAPES.join(', ')}`);
  }
  if (mode.watermarkByDefault !== undefined && typeof mode.watermarkByDefault !== 'boolean') {
    c.fail('watermarkByDefault', 'expected true or false');
  }
  if (mode.subtitleBaselineY !== undefined) {
    const y = mode.subtitleBaselineY;
    if (typeof y !== 'number' || !Number.isFinite(y) || y < 0) {
      c.fail('subtitleBaselineY', 'expected a number of pixels from the top of the frame');
    }
  }
  if (mode.pictures !== undefined) {
    if (!Array.isArray(mode.pictures)) {
      c.fail('pictures', 'expected an array');
      return;
    }
    const ids = new Set<string>();
    mode.pictures.forEach((raw, i) => {
      const picture = c.object(`pictures[${i}]`, raw);
      if (picture === null) return;
      const id = c.string(`pictures[${i}].id`, picture.id);
      if (id !== null) {
        if (ids.has(id)) c.fail(`pictures[${i}].id`, `duplicate id ${JSON.stringify(id)}`);
        ids.add(id);
      }
      const file = c.string(`pictures[${i}].path`, picture.path);
      if (file !== null && !path.isAbsolute(file)) {
        c.fail(`pictures[${i}].path`, 'expected an absolute path');
      }
      const description = c.string(`pictures[${i}].description`, picture.description);
      if (description !== null && description.trim() === '') {
        // A picture nobody described is a picture nobody can choose between.
        c.fail(`pictures[${i}].description`, 'expected a description in the client’s own words');
      }
    });
  }
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
/**
 * Content hashes over the mode fields a given consumer actually reads.
 *
 * A cache fingerprint keyed on `mode.version` says "something in this file
 * changed", which is almost never the question. Block 4 session 3 bumped the
 * mode to v3 for a variation-axis vocabulary change that the Gemini analysis
 * call never sees, and every analysis entry was invalidated — a full paid
 * re-run on every reel for an edit the model could not have noticed. A font
 * landing at Block 9 would do the same.
 *
 * So each consumer keys on the fields it reads, enumerated here rather than
 * inferred. Block 3 set the precedent by fingerprinting the transcript on its
 * content rather than a version. Adding a field to a prompt means adding it
 * to the matching hash; a hash that drifts from its prompt serves stale
 * answers, so these live next to the mode and not next to the callers.
 */
function contentHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
}

/**
 * What the keyword prompt reads: the client's name, and its vocabulary as an
 * explicit term list (`analysis/keywords.ts`). Nothing else in the mode
 * reaches that call.
 */
export function keywordModeContentHash(mode: ClientMode): string {
  return contentHash([mode.name, mode.vocabulary]);
}

/**
 * What the image-slot prompt reads: the client's name and nothing else
 * (`analysis/slots.ts`). Deliberately not the vocabulary — that call never
 * sees it, and keying on it would re-run every slot when Block 9 fills the
 * vocabulary in.
 */
export function slotModeContentHash(mode: ClientMode): string {
  return contentHash([mode.name]);
}

/**
 * What prompt composition reads: the palette (substituted into the style
 * fragments), both halves of `imageStyle`, and the variation axes. This is
 * pure and free to re-run, so it keys nothing that bills — it exists so a
 * plan can record which composition produced its prompts.
 */
export function compositionContentHash(mode: ClientMode): string {
  return contentHash([
    mode.palette,
    mode.imageStyle.stylePrompt,
    mode.imageStyle.negativePrompt,
    mode.imageVariation.axes,
  ]);
}

export function requireFonts(mode: ClientMode, stage: string): { latin: string; arabic: string } {
  if (mode.fonts.status === 'tbd') throw new ModeFontsUnresolvedError(mode.id, stage);
  return { latin: mode.fonts.latin, arabic: mode.fonts.arabic };
}
