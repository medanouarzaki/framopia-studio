import { PALETTE_ROLES } from '@framopia/core';
import {
  EDIT_PLAN_SCHEMA_VERSION,
  PIPELINE_STAGES,
  WATERMARK_SIZES,
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

const WATERMARK_SIZE_SET = new Set<string>(WATERMARK_SIZES);
const STATUSES = new Set(['pending', 'running', 'done', 'error']);
const LANGS = new Set(['darija', 'msa', 'fr', 'en', 'mixed']);
const SCRIPTS = new Set(['latin', 'arabic']);
const REMOVED_REASONS = new Set(['filler', 'stutter', 'falseStart']);
// The generation tiers a candidate may record. 4K is deliberately absent: the
// image comps work at 1200x1200, so it is paid-for pixels that get scaled
// away, and config validation rejects it before anything is generated.
const CANDIDATE_RESOLUTIONS = new Set(['1K', '2K']);
const ZONE_KINDS = new Set(['top', 'left', 'right', 'torso']);

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

const CACHE_PROVENANCES = new Set(['exact', 'compatible', 'none']);

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
    // Optional with a default: absent means the plan predates the resolver,
    // which is not the same as a stage that recorded nothing.
    if (stage.cacheEntryId !== undefined) {
      c.nullableString(`${p}.cacheEntryId`, stage.cacheEntryId);
    }
    if (stage.cacheProvenance !== undefined && stage.cacheProvenance !== null) {
      c.oneOf(`${p}.cacheProvenance`, stage.cacheProvenance, CACHE_PROVENANCES);
    }
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
    if (w.langDisagreement !== undefined) c.boolean(`${p}.langDisagreement`, w.langDisagreement);
  });

  // Optional with a default, per the standing schema rule: absent means the
  // analysis pass has not run, and every plan written before Block 6 session 5
  // must still open. Validated only when present.
  if (transcript.terms !== undefined) {
    const terms = c.array('transcript.terms', transcript.terms);
    if (terms === null) return;
    const known = new Map<string, Rec>();
    words.forEach((raw) => {
      const w = raw as Rec;
      if (typeof w?.id === 'string') known.set(w.id, w);
    });
    const claimed = new Map<string, number>();
    terms.forEach((raw, i) => {
      const p = `transcript.terms[${i}]`;
      const term = c.object(p, raw);
      if (term === null) return;
      const ids = c.array(`${p}.wordIds`, term.wordIds);
      if (ids === null) return;
      if (ids.length === 0) c.fail(`${p}.wordIds`, 'a term must span at least one word');
      ids.forEach((id, j) => {
        if (typeof id !== 'string') {
          c.fail(`${p}.wordIds[${j}]`, 'must be a string');
          return;
        }
        const word = known.get(id);
        if (word === undefined) {
          c.fail(`${p}.wordIds[${j}]`, `no transcript word has id ${id}`);
          return;
        }
        // A term is an ORTHOGRAPHY_GUIDE §6 Arabic-script domain term. A Latin
        // word inside one would make §6c's whole-term rule ungroupable.
        if (word.script !== 'arabic') {
          c.fail(`${p}.wordIds[${j}]`, `word ${id} is not Arabic script`);
        }
        if (word.removed === true) {
          c.fail(`${p}.wordIds[${j}]`, `word ${id} is removed`);
        }
        const owner = claimed.get(id);
        if (owner !== undefined) {
          c.fail(`${p}.wordIds[${j}]`, `word ${id} is already claimed by transcript.terms[${owner}]`);
        } else {
          claimed.set(id, i);
        }
      });
    });
  }
}

/** PROJECT_SPEC §5's fast-reel style. Absolute, and it predates every rule
 * that touches groups. */
const MAX_GROUP_WORDS = 2;
const KEYWORD_KINDS = new Set(['label', 'promise']);

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
    if (g.supersededBy !== undefined) c.nullableString(`${p}.supersededBy`, g.supersededBy);
    if (g.edited !== undefined) c.boolean(`${p}.edited`, g.edited);
    if (g.displayStart !== undefined) c.number(`${p}.displayStart`, g.displayStart);
    if (g.displayEnd !== undefined) c.number(`${p}.displayEnd`, g.displayEnd);
    if (typeof g.displayStart === 'number' && typeof g.displayEnd === 'number') {
      if (g.displayEnd < g.displayStart) {
        c.fail(`${p}.displayEnd`, 'a display window cannot end before it starts');
      }
      if (typeof g.end === 'number' && g.displayEnd < g.end) {
        c.fail(`${p}.displayEnd`, 'a card cannot leave before its last word is spoken');
      }
    }
    if (ids !== null && ids.length > MAX_GROUP_WORDS) {
      c.fail(`${p}.wordIds`, `a group holds at most ${MAX_GROUP_WORDS} words, found ${ids.length}`);
    }
  });
}

/**
 * A keyword points at transcript words, so the same id check the subtitle
 * groups get applies here. Two rules beyond shape, both of which would
 * otherwise reach a client's build: a keyword may not name a removed word,
 * and two keywords may not claim the same word.
 */
function checkKeywords(c: Checker, value: unknown, words: Map<string, Rec>): void {
  const keywords = c.object('keywords', value);
  if (keywords === null) return;
  c.oneOf('keywords.mode', keywords.mode, new Set(['auto', 'propose']));
  /*
   * Optional with a default: absent means nothing has been removed by hand.
   * Each id must name a real word, so a stale marker cannot outlive the word it
   * refers to and quietly suppress a different one.
   */
  if (keywords.removedWordIds !== undefined) {
    const removed = c.array('keywords.removedWordIds', keywords.removedWordIds);
    if (removed !== null) {
      removed.forEach((raw, i) => {
        const p = `keywords.removedWordIds[${i}]`;
        if (typeof raw !== 'string') {
          c.string(p, raw);
          return;
        }
        if (!words.has(raw)) c.fail(p, `names no word in the transcript: "${raw}"`);
      });
    }
  }
  const items = c.array('keywords.items', keywords.items);
  if (items === null) return;

  const claimed = new Map<string, number>();
  items.forEach((raw, i) => {
    const p = `keywords.items[${i}]`;
    const k = c.object(p, raw);
    if (k === null) return;
    c.string(`${p}.id`, k.id);
    c.string(`${p}.text`, k.text);
    c.string(`${p}.reason`, k.reason);
    c.boolean(`${p}.approved`, k.approved);
    c.number(`${p}.start`, k.start);
    c.number(`${p}.end`, k.end);
    c.nullableString(`${p}.templateId`, k.templateId);
    if (k.kind !== undefined) c.oneOf(`${p}.kind`, k.kind, KEYWORD_KINDS);

    if (typeof k.score !== 'number' || !Number.isFinite(k.score)) {
      c.fail(`${p}.score`, 'expected a number');
    } else if (k.score < 0 || k.score > 1) {
      c.fail(`${p}.score`, `expected a score between 0 and 1, found ${k.score}`);
    }

    const ids = c.array(`${p}.wordIds`, k.wordIds);
    if (ids === null) return;
    if (ids.length === 0) c.fail(`${p}.wordIds`, 'a keyword must reference at least one word');
    ids.forEach((id, j) => {
      if (typeof id !== 'string') {
        c.fail(`${p}.wordIds[${j}]`, 'expected a string');
        return;
      }
      const word = words.get(id);
      if (word === undefined) {
        c.fail(`${p}.wordIds[${j}]`, `no transcript word has id ${id}`);
        return;
      }
      if (word.removed === true) {
        c.fail(`${p}.wordIds[${j}]`, `word ${id} is removed and cannot be a keyword`);
      }
      const owner = claimed.get(id);
      if (owner !== undefined) {
        c.fail(`${p}.wordIds[${j}]`, `word ${id} is already claimed by keywords.items[${owner}]`);
      } else {
        claimed.set(id, i);
      }
    });
  });
}

const PRESENTATIONS = new Set(['cutout', 'card']);
const SLOT_STATUSES = new Set(['pending', 'generated', 'approved']);

/**
 * Slots point at transcript words like keywords do, so the same id check
 * applies, plus the two rules the planner enforces: a slot's window must be
 * ordered, and two slots must not overlap in time.
 */
function checkImages(c: Checker, value: unknown, words: Map<string, Rec>): void {
  const images = c.object('images', value);
  if (images === null) return;
  const slots = c.array('images.slots', images.slots);
  if (slots === null) return;

  let previousEnd: number | null = null;
  slots.forEach((raw, i) => {
    const p = `images.slots[${i}]`;
    const slot = c.object(p, raw);
    if (slot === null) return;
    c.string(`${p}.id`, slot.id);
    c.string(`${p}.contextText`, slot.contextText);
    c.string(`${p}.idea`, slot.idea);
    c.string(`${p}.prompt`, slot.prompt);
    c.string(`${p}.negativePrompt`, slot.negativePrompt);
    const candidates = c.array(`${p}.candidates`, slot.candidates);
    candidates?.forEach((raw, ci) => {
      const cp = `${p}.candidates[${ci}]`;
      const cand = c.object(cp, raw);
      if (cand === null) return;
      c.string(`${cp}.id`, cand.id);
      c.string(`${cp}.path`, cand.path);
      c.nullableString(`${cp}.cutoutPath`, cand.cutoutPath);
      c.nullableNumber(`${cp}.cutoutQuality`, cand.cutoutQuality);
      // Block 4 fields are checked only when present. Absent is legal and is
      // what every plan written before Block 4 has; requiring one here would
      // make those plans unopenable, migration included.
      if (cand.modelId !== undefined) c.string(`${cp}.modelId`, cand.modelId);
      if (cand.resolution !== undefined) {
        c.oneOf(`${cp}.resolution`, cand.resolution, CANDIDATE_RESOLUTIONS);
      }
      if (cand.generatedAt !== undefined) c.string(`${cp}.generatedAt`, cand.generatedAt);
      if (cand.costUsd !== undefined) c.number(`${cp}.costUsd`, cand.costUsd);
      if (cand.promptFingerprint !== undefined) {
        c.string(`${cp}.promptFingerprint`, cand.promptFingerprint);
      }
      if (cand.detectedText !== undefined && cand.detectedText !== null) {
        const found = c.array(`${cp}.detectedText`, cand.detectedText);
        found?.forEach((raw, di) => {
          const dp = `${cp}.detectedText[${di}]`;
          const detection = c.object(dp, raw);
          if (detection === null) return;
          c.string(`${dp}.text`, detection.text);
          c.number(`${dp}.confidence`, detection.confidence);
          if (
            typeof detection.confidence === 'number' &&
            (detection.confidence < 0 || detection.confidence > 1)
          ) {
            c.fail(`${dp}.confidence`, 'expected a number between 0 and 1');
          }
        });
      }
      if (cand.textVerdict !== undefined && cand.textVerdict !== null) {
        const vp = `${cp}.textVerdict`;
        const verdict = c.object(vp, cand.textVerdict);
        if (verdict !== null) {
          c.boolean(`${vp}.hasText`, verdict.hasText);
          c.boolean(`${vp}.ok`, verdict.ok);
          c.array(`${vp}.expected`, verdict.expected);
          const unexpected = c.array(`${vp}.unexpected`, verdict.unexpected);
          // `ok` restates whether `unexpected` is empty. Cross-checked so a
          // plan cannot claim a clean verdict while naming offending words.
          if (unexpected !== null && typeof verdict.ok === 'boolean') {
            if (verdict.ok !== (unexpected.length === 0)) {
              c.fail(`${vp}.ok`, 'must be true exactly when unexpected is empty');
            }
          }
        }
      }
      if (cand.gate !== undefined && cand.gate !== null) {
        const gp = `${cp}.gate`;
        const gate = c.object(gp, cand.gate);
        if (gate !== null) {
          c.oneOf(`${gp}.presentation`, gate.presentation, PRESENTATIONS);
          c.boolean(`${gp}.passed`, gate.passed);
          const failures = c.array(`${gp}.failures`, gate.failures);
          if (failures !== null && typeof gate.passed === 'boolean') {
            if (gate.passed !== (failures.length === 0)) {
              c.fail(`${gp}.passed`, 'must be true exactly when failures is empty');
            }
          }
        }
      }
      if (cand.metrics !== undefined && cand.metrics !== null) {
        const m = c.object(`${cp}.metrics`, cand.metrics);
        if (m !== null) {
          c.number(`${cp}.metrics.alphaEdgeNoise`, m.alphaEdgeNoise);
          c.number(`${cp}.metrics.holeRatio`, m.holeRatio);
          c.number(`${cp}.metrics.foregroundArea`, m.foregroundArea);
          c.number(`${cp}.metrics.edgeHalo`, m.edgeHalo);
        }
      }
    });
    c.nullableString(`${p}.chosenCandidateId`, slot.chosenCandidateId);
    if (slot.chosenClientPictureId !== undefined) {
      c.string(`${p}.chosenClientPictureId`, slot.chosenClientPictureId);
    }
    // Optional with a default: absent on every plan written before Block 8
    // session 30, and on any slot whose choice did not override the gate.
    if (slot.overriddenGateFailures !== undefined) {
      const overridden = c.array(`${p}.overriddenGateFailures`, slot.overriddenGateFailures);
      (overridden ?? []).forEach((f, k) => c.string(`${p}.overriddenGateFailures[${k}]`, f));
    }
    c.nullableString(`${p}.zoneId`, slot.zoneId);
    c.nullableString(`${p}.templateId`, slot.templateId);
    c.oneOf(`${p}.status`, slot.status, SLOT_STATUSES);
    /*
     * Optional with a default: absent on every plan written before slot prompt
     * v3, which is all six of them. A picture may start later inside its own
     * span and nowhere else, so a word outside the span is a fault rather than
     * something to absorb.
     */
    if (slot.nameWordId !== undefined) {
      c.string(`${p}.nameWordId`, slot.nameWordId);
      const ids = Array.isArray(slot.wordIds) ? (slot.wordIds as unknown[]) : [];
      if (!ids.includes(slot.nameWordId)) {
        c.fail(
          `${p}.nameWordId`,
          `is ${JSON.stringify(slot.nameWordId)}, which is not one of this slot's wordIds`,
        );
      }
    }
    if (slot.promptModeVersion !== undefined) {
      c.number(`${p}.promptModeVersion`, slot.promptModeVersion);
    }
    // Optional with a default under the schema fragility rule: validated only
    // when present, so a plan written before the solver existed still opens.
    if (slot.position !== undefined && slot.position !== null) {
      const position = c.object(`${p}.position`, slot.position);
      if (position !== null) {
        for (const axis of ['x', 'y'] as const) {
          const value = position[axis];
          if (typeof value !== 'number' || !Number.isFinite(value)) {
            c.fail(`${p}.position.${axis}`, 'expected a number');
          } else if (value < 0 || value > 1) {
            c.fail(`${p}.position.${axis}`, 'expected 0-1');
          }
        }
      }
    }
    if (slot.scale !== undefined && slot.scale !== null) {
      if (typeof slot.scale !== 'number' || !Number.isFinite(slot.scale) || slot.scale <= 0) {
        c.fail(`${p}.scale`, 'expected a positive number');
      }
    }
    if (slot.presentation !== null) {
      c.oneOf(`${p}.presentation`, slot.presentation, PRESENTATIONS);
    }

    c.number(`${p}.start`, slot.start);
    c.number(`${p}.end`, slot.end);
    if (typeof slot.start === 'number' && typeof slot.end === 'number') {
      if (slot.end < slot.start) c.fail(`${p}.end`, 'a slot cannot end before it starts');
      if (previousEnd !== null && slot.start < previousEnd) {
        c.fail(`${p}.start`, `slot overlaps the previous slot, which ends at ${previousEnd}`);
      }
      previousEnd = slot.end;
    }

    const ids = c.array(`${p}.wordIds`, slot.wordIds);
    if (ids === null) return;
    if (ids.length === 0) c.fail(`${p}.wordIds`, 'a slot must reference at least one word');
    ids.forEach((id, j) => {
      if (typeof id !== 'string') {
        c.fail(`${p}.wordIds[${j}]`, 'expected a string');
      } else if (!words.has(id)) {
        c.fail(`${p}.wordIds[${j}]`, `no transcript word has id ${id}`);
      }
    });
  });
}

/**
 * Structural agreement between a `supersededBy` and the keyword it names: the
 * keyword exists, and the cards it supersedes are consecutive and hold exactly
 * the span's words, in order.
 *
 * **A keyword may supersede more than one card.** It had to be exactly one
 * while cards held 1-2 words and a span could always be collapsed into a single
 * card; at one word per card (Block 7 session 6) a two-word keyword covers two
 * cards and marks both. What is still a defect is a span whose superseded cards
 * hold words the span does not, or hold them in a different order.
 *
 * The completeness half — that *every* keyword supersedes some group — is
 * deliberately not here. It is a buildability property, checked by
 * `npm run validate-plan`, because a plan written before supersession existed
 * is structurally fine and must still be readable; failing it here would make
 * an older plan impossible to open and therefore impossible to migrate.
 */
function checkSupersession(c: Checker, plan: Rec): void {
  const keywords = (plan.keywords as Rec | undefined)?.items;
  const groups = (plan.subtitles as Rec | undefined)?.groups;
  if (!Array.isArray(keywords) || !Array.isArray(groups)) return;

  const keywordById = new Map<string, Rec>();
  for (const k of keywords) {
    if (typeof k === 'object' && k !== null && typeof (k as Rec).id === 'string') {
      keywordById.set((k as Rec).id as string, k as Rec);
    }
  }

  const claimed = new Map<string, { index: number; words: string[] }[]>();
  groups.forEach((raw, i) => {
    if (typeof raw !== 'object' || raw === null) return;
    const g = raw as Rec;
    const owner = g.supersededBy;
    if (typeof owner !== 'string') return;
    const p = `subtitles.groups[${i}].supersededBy`;
    if (!keywordById.has(owner)) {
      c.fail(p, `no keyword has id ${owner}`);
      return;
    }
    const list = claimed.get(owner) ?? [];
    list.push({ index: i, words: Array.isArray(g.wordIds) ? (g.wordIds as string[]) : [] });
    claimed.set(owner, list);
  });

  for (const [owner, cards] of claimed) {
    const first = cards[0];
    if (first === undefined) continue;
    const p = `subtitles.groups[${first.index}].supersededBy`;
    for (let k = 1; k < cards.length; k += 1) {
      if ((cards[k] as { index: number }).index !== (cards[k - 1] as { index: number }).index + 1) {
        c.fail(p, `keyword ${owner} supersedes cards that are not consecutive`);
        break;
      }
    }
    const span = keywordById.get(owner)?.wordIds;
    if (!Array.isArray(span)) continue;
    const covered = cards.flatMap((x) => x.words);
    const same = span.length === covered.length && span.every((id, j) => id === covered[j]);
    if (!same) {
      c.fail(p, `keyword ${owner} does not span exactly the words of the card(s) it supersedes`);
    }
  }
}

/**
 * Zone items, ARCHITECTURE §3. The container has existed since the schema was
 * written and every plan carries it as an empty array, so validating the items
 * cannot make an older plan unopenable: there are no items in one to reject.
 */
function checkZones(c: Checker, items: unknown[]): void {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    const path = `zones.zones[${index}]`;
    const zone = c.object(path, item);
    if (zone === null) return;

    c.string(`${path}.id`, zone.id);
    if (typeof zone.id === 'string') {
      if (seen.has(zone.id)) c.fail(`${path}.id`, `duplicate zone id ${zone.id}`);
      seen.add(zone.id);
    }
    if (typeof zone.kind !== 'string' || !ZONE_KINDS.has(zone.kind)) {
      c.fail(`${path}.kind`, `expected one of ${[...ZONE_KINDS].join(', ')}`);
    }
    if (typeof zone.manual !== 'boolean') c.fail(`${path}.manual`, 'expected a boolean');

    const rect = c.object(`${path}.rect`, zone.rect);
    if (rect !== null) {
      const axes: number[] = [];
      for (const axis of ['x', 'y', 'w', 'h'] as const) {
        const value = rect[axis];
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          c.fail(`${path}.rect.${axis}`, 'expected a number');
          continue;
        }
        // Normalized against the frame, so a rect outside the unit square is
        // a coordinate-basis mistake rather than an unusual zone.
        if (value < 0 || value > 1) c.fail(`${path}.rect.${axis}`, 'expected 0-1');
        axes.push(value);
      }
      if (axes.length === 4) {
        const [x = 0, y = 0, w = 0, h = 0] = axes;
        if (w <= 0 || h <= 0) c.fail(`${path}.rect`, 'expected a positive width and height');
        // A float sum of normalized edges lands a hair over 1 often enough
        // that an exact comparison would reject correct rectangles.
        if (x + w > 1.0000001 || y + h > 1.0000001) {
          c.fail(`${path}.rect`, 'extends past the frame');
        }
      }
    }

    const valid = c.array(`${path}.valid`, zone.valid);
    if (valid !== null) {
      valid.forEach((window, w) => {
        const wPath = `${path}.valid[${w}]`;
        if (!Array.isArray(window) || window.length !== 2) {
          c.fail(wPath, 'expected a [startS, endS] pair');
          return;
        }
        const [start, end] = window as unknown[];
        if (typeof start !== 'number' || typeof end !== 'number') {
          c.fail(wPath, 'expected two numbers');
          return;
        }
        if (start < 0) c.fail(wPath, 'starts before the reel');
        if (end < start) c.fail(wPath, 'ends before it starts');
      });
    }
  });
}

function checkContainers(c: Checker, plan: Rec): void {


  const zones = c.object('zones', plan.zones);
  if (zones !== null) {
    c.number('zones.sampleFps', zones.sampleFps);
    const items = c.array('zones.zones', zones.zones);
    if (items !== null) checkZones(c, items);
  }

  const sfx = c.object('sfx', plan.sfx);
  if (sfx !== null) c.array('sfx.events', sfx.events);

  if (plan.watermark !== null) {
    const watermark = c.object('watermark', plan.watermark);
    if (watermark !== null) {
      c.string('watermark.assetPath', watermark.assetPath);
      c.number('watermark.startS', watermark.startS);
      c.nullableNumber('watermark.durationS', watermark.durationS);
      if (watermark.size !== undefined) {
        c.oneOf('watermark.size', watermark.size, WATERMARK_SIZE_SET);
      }
    }
  }

  const costs = c.object('costs', plan.costs);
  if (costs !== null) {
    c.number('costs.totalUsd', costs.totalUsd);
    c.object('costs.byStage', costs.byStage);
    // Optional with a default: absent on every plan written before Block 4
    // session 7, and absent means unknown rather than zero.
    if (costs.spentUsd !== undefined) c.number('costs.spentUsd', costs.spentUsd);
    if (costs.spentByStage !== undefined) c.object('costs.spentByStage', costs.spentByStage);
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

  // Optional with a default, and so validated only when present: every plan
  // written before Block 9 session 2 has none and must still open, including
  // for the migration that adds one.
  if (plan.clientSnapshot !== undefined && plan.clientSnapshot !== null) {
    const snap = c.object('clientSnapshot', plan.clientSnapshot);
    if (snap !== null) {
      c.number('clientSnapshot.snapshotVersion', snap.snapshotVersion);
      c.string('clientSnapshot.id', snap.id);
      c.string('clientSnapshot.name', snap.name);
      c.number('clientSnapshot.version', snap.version);
      c.string('clientSnapshot.capturedAt', snap.capturedAt);
      c.number('clientSnapshot.imageScale', snap.imageScale);
      const palette = c.object('clientSnapshot.palette', snap.palette);
      if (palette !== null) {
        for (const role of PALETTE_ROLES) {
          c.string(`clientSnapshot.palette.${role}`, palette[role]);
        }
      }
      const colours = c.object('clientSnapshot.textColours', snap.textColours);
      if (colours !== null) {
        for (const key of ['ordinary', 'emphasis']) {
          const role = colours[key];
          if (typeof role !== 'string' || !(PALETTE_ROLES as readonly string[]).includes(role)) {
            c.fail(
              `clientSnapshot.textColours.${key}`,
              `expected a palette role, one of ${PALETTE_ROLES.join(', ')}`,
            );
          }
        }
      }
      const fonts = c.object('clientSnapshot.fonts', snap.fonts);
      if (fonts !== null) c.string('clientSnapshot.fonts.status', fonts.status);
    }
  }

  checkPipeline(c, plan.pipeline);
  checkWords(c, plan.transcript);

  const words = (plan.transcript as Rec | undefined)?.words;
  const byId = new Map<string, Rec>();
  if (Array.isArray(words)) {
    for (const w of words) {
      if (typeof w !== 'object' || w === null) continue;
      const record = w as Rec;
      if (typeof record.id === 'string') byId.set(record.id, record);
    }
  }
  checkSubtitles(c, plan.subtitles, new Set(byId.keys()));
  checkKeywords(c, plan.keywords, byId);
  checkSupersession(c, plan);
  checkImages(c, plan.images, byId);
  checkContainers(c, plan);

  return c.issues;
}

export function assertValidEditPlan(value: unknown): EditPlan {
  const issues = validateEditPlan(value);
  if (issues.length > 0) throw new EditPlanValidationError(issues);
  return value as EditPlan;
}
