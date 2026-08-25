import type { SfxIndex, TemplateEntry } from '@framopia/core';
import type { EditPlan, SfxEvent } from '../editplan/types.js';

export class UnknownSfxError extends Error {
  constructor(
    readonly sfxId: string,
    readonly templateId: string,
  ) {
    super(
      `template ${templateId} binds sfx ${sfxId}, which assets/sfx/sfx.json does not define. ` +
        'A missing sound is a configuration error, never something to skip.',
    );
    this.name = 'UnknownSfxError';
  }
}

/**
 * ARCHITECTURE §3: sfx events are generated, never hand-authored, and
 * recomputed on every run. Nothing here reads the plan's existing events.
 *
 * An event fires at the element's start plus the manifest's offset. The
 * element's start is where its intro begins, so the offset is measured from
 * the first frame of the animation rather than from its settled hold.
 *
 * Gain comes from the binding rather than the sfx index default: the index
 * default is what a sound is worth on its own, the binding is what this
 * template wants of it.
 */
export function deriveSfxEvents(
  plan: EditPlan,
  templates: Map<string, TemplateEntry>,
  sfxIndex: SfxIndex,
): SfxEvent[] {
  const known = new Set(sfxIndex.sfx.map((s) => s.id));
  const events: SfxEvent[] = [];

  const elements: { id: string; start: number; templateId: string | null }[] = [
    ...plan.subtitles.groups.map((g) => ({ id: g.id, start: g.start, templateId: g.templateId })),
    ...plan.keywords.items.map((k) => ({ id: k.id, start: k.start, templateId: k.templateId })),
    ...plan.images.slots.map((s) => ({ id: s.id, start: s.start, templateId: s.templateId })),
  ];

  for (const element of elements) {
    if (element.templateId === null) continue;
    const template = templates.get(element.templateId);
    if (template === undefined) continue;
    for (const binding of template.sfx) {
      if (!known.has(binding.sfxId)) throw new UnknownSfxError(binding.sfxId, template.id);
      events.push({
        id: 'pending',
        sourceElementId: element.id,
        sfxId: binding.sfxId,
        timeS: element.start + binding.offsetS,
        gainDb: binding.gainDb,
      });
    }
  }

  events.sort((a, b) => a.timeS - b.timeS || (a.sourceElementId < b.sourceElementId ? -1 : 1));
  return events.map((e, i) => ({ ...e, id: `sfx${String(i + 1).padStart(3, '0')}` }));
}
