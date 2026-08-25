import { createHash } from 'node:crypto';
import type { ClientMode, TemplateEntry, TemplateKind } from '@framopia/core';
import type { EditPlan } from '../editplan/types.js';

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
 * PROJECT_SPEC §5: "Deterministic: no AI style-picking, no randomness." The
 * same walk the image variation draw uses, and for the same reason — an
 * offset and a stride seeded from the plan id, with the stride taken from the
 * values coprime to the variant count so consecutive elements never repeat
 * and the walk covers every variant, plus a per-cycle bump so a sequence
 * longer than the variant list does not repeat its opening run.
 *
 * Session 4 shipped a variation draw whose fifth slot was an exact copy of
 * its first; the bump is the fix generalised, and `variantDistribution` below
 * exists so a whole sequence can be inspected rather than only its adjacent
 * pairs.
 */
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function pickVariant(variants: string[], planId: string, kind: string, index: number): string {
  if (variants.length === 1) return variants[0] as string;
  const digest = createHash('sha256').update(`${planId}:${kind}`).digest();
  const offset = digest.readUInt32BE(0) % variants.length;
  const strides = Array.from({ length: variants.length - 1 }, (_, i) => i + 1).filter(
    (s) => gcd(s, variants.length) === 1,
  );
  const stride = strides[digest.readUInt32BE(4) % strides.length] as number;
  const bumps = Array.from({ length: variants.length - 1 }, (_, i) => i + 1).filter(
    (b) => (stride + b) % variants.length !== 0,
  );
  const bump = bumps.length === 0 ? 0 : (bumps[digest.readUInt32BE(8) % bumps.length] as number);
  const cycle = Math.floor(index / variants.length);
  return variants[(offset + stride * index + bump * cycle) % variants.length] as string;
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

  const subtitle = variantsFor('subtitle');
  plan.subtitles.groups.forEach((group, i) => {
    const id = pickVariant(subtitle, plan.meta.id, 'subtitle', i);
    group.templateId = id;
    assigned.subtitle.push(id);
  });

  const keyword = variantsFor('keyword');
  plan.keywords.items.forEach((item, i) => {
    const id = pickVariant(keyword, plan.meta.id, 'keyword', i);
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
