import { createHash } from 'node:crypto';
import type { ClientMode, TemplateEntry, TemplateKind } from '@framopia/core';
import type { EditPlan } from '../editplan/types.js';

/** TEMPLATE_LIBRARY_GUIDE §3's suffix for the Arabic-script variant of a text template. */
export const SCRIPT_VARIANT_SUFFIX = '_ar';

export class NoTemplateVariantError extends Error {
  constructor(
    readonly modeId: string,
    readonly kind: TemplateKind,
  ) {
    super(
      `mode ${modeId} allows no ${kind} template, so ${kind} elements cannot be assigned one. ` +
        'A missing variant is a configuration error, never something to skip.',
    );
    this.name = 'NoTemplateVariantError';
  }
}

/**
 * PROJECT_SPEC §5: "Deterministic: no AI style-picking, no randomness."
 *
 * Session 4's coprime-stride walk satisfied that and produced 14/14/14 with a
 * longest run of 1 — which is a visible A, B, C cycle, and PROJECT_SPEC §1
 * rules out machine-uniform output. So the walk is a **seeded shuffle**
 * instead: each block of variants is permuted by a hash of the plan id, the
 * element type and the block number, and a permutation whose first element
 * repeats the previous block's last is rotated until it does not.
 *
 * Determinism is unchanged — the same plan and element type always produce the
 * same sequence — and the no-adjacent-repeat constraint from session 4
 * survives, without the sequence announcing its own period.
 */
function shuffle<T>(items: T[], seed: string): T[] {
  const out = [...items];
  // Fisher-Yates driven by a hash chain, so the permutation is a pure
  // function of the seed.
  let digest = createHash('sha256').update(seed).digest();
  let cursor = 0;
  for (let i = out.length - 1; i > 0; i -= 1) {
    if (cursor + 4 > digest.length) {
      digest = createHash('sha256').update(digest).digest();
      cursor = 0;
    }
    const j = digest.readUInt32BE(cursor) % (i + 1);
    cursor += 4;
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/**
 * The permutation actually used for a block, which depends on the block before
 * it: a block whose first variant repeats the previous block's last is rotated
 * until it does not. Chained from block 0 so the comparison is against what
 * was really emitted, not against an unrotated draft.
 */
function blockPermutation(variants: string[], planId: string, kind: string, block: number): string[] {
  let previousLast: string | undefined;
  let permuted: string[] = [];
  for (let b = 0; b <= block; b += 1) {
    permuted = shuffle(variants, `${planId}:${kind}:${b}`);
    // Rotate rather than reshuffle: a reshuffle could collide again, and a
    // rotation is bounded and still deterministic.
    for (let r = 0; r < permuted.length && permuted[0] === previousLast; r += 1) {
      permuted.push(permuted.shift() as string);
    }
    previousLast = permuted[permuted.length - 1];
  }
  return permuted;
}

export function pickVariant(variants: string[], planId: string, kind: string, index: number): string {
  if (variants.length === 1) return variants[0] as string;
  const block = Math.floor(index / variants.length);
  const permuted = blockPermutation(variants, planId, kind, block);
  return permuted[index % variants.length] as string;
}

/** How often each variant was actually used, for the report. */
export function variantDistribution(assigned: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of assigned) counts[id] = (counts[id] ?? 0) + 1;
  return counts;
}

/** The longest run of the same variant back to back. One means no repeats. */
export function longestRun(assigned: string[]): number {
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const id of assigned) {
    run = id === previous ? run + 1 : 1;
    previous = id;
    if (run > best) best = run;
  }
  return best;
}

export interface AssignmentIssue {
  path: string;
  message: string;
}

export interface AssignmentResult {
  /** Element type to the variant ids assigned, in element order. */
  assigned: Record<TemplateKind, string[]>;
  issues: AssignmentIssue[];
}

/**
 * Fills every element's `templateId` from the mode. Mutates the plan, because
 * the caller is about to write it and copying a plan to change one field per
 * element would obscure that.
 *
 * A subtitle group superseded by a keyword still gets a template: the keyword
 * replaces its rendering, but which group it replaces has to stay legible
 * after the fact, and a null there would read as "not yet assigned".
 */
export function assignTemplates(
  plan: EditPlan,
  mode: ClientMode,
  templates: Map<string, TemplateEntry>,
): AssignmentResult {
  const issues: AssignmentIssue[] = [];
  const assigned: Record<TemplateKind, string[]> = { subtitle: [], keyword: [], image: [] };

  const variantsFor = (kind: TemplateKind): string[] => {
    const ids = mode.allowedTemplates[kind];
    if (ids === undefined || ids.length === 0) throw new NoTemplateVariantError(mode.id, kind);
    return ids;
  };

  const scriptOfWord = new Map(plan.transcript.words.map((w) => [w.id, w.script]));

  /**
   * A text element's script decides which face renders it, so it decides the
   * variant. Re-grouping cuts at every script change, so a group is uniformly
   * one script; a mixed one would be a defect upstream and is reported rather
   * than silently rendered in whichever face came first.
   */
  const scriptOf = (wordIds: string[]): 'arabic' | 'latin' | 'mixed' => {
    const seen = new Set(wordIds.map((id) => scriptOfWord.get(id)));
    if (seen.size > 1) return 'mixed';
    return seen.has('arabic') ? 'arabic' : 'latin';
  };

  /**
   * The `_ar` suffix is the naming convention TEMPLATE_LIBRARY_GUIDE §3 fixes
   * and `validateTemplateManifest` enforces; there is no script field on a
   * template entry to read instead. Partitioning on it here rather than
   * inspecting the text at build time keeps the choice on the plan, where it
   * can be reviewed.
   *
   * Before Block 7 session 4 the draw ignored script entirely and would have
   * put `sub_pop_ar` under 20 of vitasilk's 41 Latin cards.
   */
  const forScript = (ids: string[], script: 'arabic' | 'latin'): string[] =>
    ids.filter((id) => id.endsWith(SCRIPT_VARIANT_SUFFIX) === (script === 'arabic'));

  // The shuffle draws per script, so each face's variants still spread across
  // the reel instead of being indexed by a position most of which is the other
  // face's.
  const drawnPerScript = new Map<string, number>();
  const nextIndex = (kind: TemplateKind, script: string): number => {
    const k = `${kind}:${script}`;
    const n = drawnPerScript.get(k) ?? 0;
    drawnPerScript.set(k, n + 1);
    return n;
  };

  const pickTextVariant = (
    kind: 'subtitle' | 'keyword',
    wordIds: string[],
    path: string,
  ): string => {
    const raw = scriptOf(wordIds);
    if (raw === 'mixed') {
      issues.push({ path, message: 'spans more than one script; rendered with the Latin variant' });
    }
    const script = raw === 'arabic' ? 'arabic' : 'latin';
    const candidates = forScript(variantsFor(kind), script);
    if (candidates.length === 0) throw new NoTemplateVariantError(mode.id, kind);
    return pickVariant(candidates, plan.meta.id, `${kind}:${script}`, nextIndex(kind, script));
  };

  plan.subtitles.groups.forEach((group, i) => {
    const id = pickTextVariant('subtitle', group.wordIds, `subtitles.groups[${i}].templateId`);
    group.templateId = id;
    assigned.subtitle.push(id);
  });

  plan.keywords.items.forEach((item, i) => {
    const id = pickTextVariant('keyword', item.wordIds, `keywords.items[${i}].templateId`);
    item.templateId = id;
    assigned.keyword.push(id);
  });

  const image = variantsFor('image');
  plan.images.slots.forEach((slot, i) => {
    const id = pickVariant(image, plan.meta.id, 'image', i);
    slot.templateId = id;
    assigned.image.push(id);

    // Presentation stays unset — the cutout quality gate decides it in
    // Block 4 — but the template it would have to honour is checked now,
    // while there is still something to change.
    const entry = templates.get(id);
    if (entry === undefined) {
      issues.push({
        path: `images.slots[${i}].templateId`,
        message: `${id} is not in the template manifest`,
      });
    } else if (entry.imagePresentation === null) {
      issues.push({
        path: `images.slots[${i}].templateId`,
        message: `${id} declares no imagePresentation, so Block 4 cannot know what to produce for it`,
      });
    }
  });

  for (const [kind, ids] of Object.entries(assigned) as [TemplateKind, string[]][]) {
    for (const id of new Set(ids)) {
      const entry = templates.get(id);
      if (entry === undefined) {
        issues.push({ path: `mode.allowedTemplates.${kind}`, message: `${id} is not in the manifest` });
      } else if (entry.type !== kind) {
        issues.push({
          path: `mode.allowedTemplates.${kind}`,
          message: `${id} is typed ${entry.type} in the manifest`,
        });
      }
    }
  }

  return { assigned, issues };
}
