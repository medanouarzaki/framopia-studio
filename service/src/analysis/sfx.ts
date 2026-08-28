import { placeSfx, type SfxIndex, type TemplateEntry } from '@framopia/core';
import type { EditPlan, SfxEvent } from '../editplan/types.js';

/** 30000/1001, the rate every comp and every reel is at. */
const FPS = 30000 / 1001;

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
 * **`timeS` is the audio layer's in-point, derived so the file's anchor lands
 * on the template's impact frame.** It used to be the element's start plus the
 * manifest's offset, which assumed a sound's impact is at its first sample:
 * `hit_01`'s is 2.05 s in, so every hit's impact was landing about two seconds
 * after the card it belongs to.
 *
 * Both inputs are measurements — the anchor from `npm run sfx:measure`, the
 * impact frame from the template audit. When either is missing the old rule
 * still applies, because a placement derived from a number nobody measured is
 * the defect this replaces.
 *
 * Gain is the file's measured `gainDb` when it has one: a flat figure per kind
 * cannot land two files at the same level when their peaks are 7 dB apart. The
 * binding's gain is the fallback.
 */
export function deriveSfxEvents(
  plan: EditPlan,
  templates: Map<string, TemplateEntry>,
  sfxIndex: SfxIndex,
  /** Each template's measured impact, in seconds from the element's start. */
  impacts: Map<string, number> = new Map(),
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
      const entry = sfxIndex.sfx.find((s) => s.id === binding.sfxId);
      const measured = entry?.measured;
      const impactS = impacts.get(template.id);

      if (measured === undefined || impactS === undefined) {
        // Unmeasured: the old rule, unchanged, rather than a derived number
        // resting on an assumption.
        events.push({
          id: 'pending',
          sourceElementId: element.id,
          sfxId: binding.sfxId,
          timeS: element.start + binding.offsetS,
          gainDb: binding.gainDb,
        });
        continue;
      }

      const placed = placeSfx({
        elementStartS: element.start,
        impactS,
        peakOffsetS: measured.anchorOffsetS,
        fps: FPS,
        compStartS: 0,
      });
      events.push({
        id: 'pending',
        sourceElementId: element.id,
        sfxId: binding.sfxId,
        timeS: placed.inPointS,
        gainDb: measured.gainDb,
        anchorAtS: Number(placed.peakAtS.toFixed(6)),
        ...(placed.clamped ? { clamped: true, clampedByS: placed.clampedByS } : {}),
      });
    }
  }

  events.sort((a, b) => a.timeS - b.timeS || (a.sourceElementId < b.sourceElementId ? -1 : 1));
  return events.map((e, i) => ({ ...e, id: `sfx${String(i + 1).padStart(3, '0')}` }));
}
