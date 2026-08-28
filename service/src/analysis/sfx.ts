import {
  dialogueAttenuationDb,
  loudestBoundOffsetDb,
  placeSfx,
  sfxGainDb,
  type SfxIndex,
  type TemplateEntry,
} from '@framopia/core';
import type { EditPlan, SfxEvent } from '../editplan/types.js';

/** 30000/1001, the rate every comp and every reel is at. */
const FPS = 30000 / 1001;

/**
 * An image slot that would be built silent.
 *
 * **Every image gets a sound** (user ruling, Block 8 session 26). It was true
 * of the corpus already, but only because both image templates happen to bind a
 * whoosh; a manifest edit would have made a silent image with nothing to say so.
 *
 * A slot with no template at all is a different thing and is not this error:
 * the builder drops it and `checkBuildability` names it, and the plan passes
 * through that state legitimately before templates are assigned.
 */
export class SilentImageSlotError extends Error {
  constructor(readonly slotIds: string[]) {
    super(
      `image slots ${slotIds.join(', ')} would carry no sound. Every image gets one: ` +
        'check the template binding in templates/manifest.json and that the slot has a template.',
    );
    this.name = 'SilentImageSlotError';
  }
}

export interface SfxDerivation {
  events: SfxEvent[];
}

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
 * manifest's offset, which assumed a sound's impact is at its first sample.
 *
 * Both inputs are measurements — the anchor from `npm run sfx:measure`, the
 * impact frame from the template audit. When either is missing the old rule
 * still applies, because a placement derived from a number nobody measured is
 * the defect this replaces.
 *
 * **Gain is measured against the reel's own dialogue**, not against full scale,
 * and against the dialogue **as the build will play it** — every reel here is
 * delivered with its peak on full scale, so the build turns the whole mix down
 * to make room and the offsets are taken from the attenuated level. Both halves
 * come from `dialogueAttenuationDb`, which the builder reads too, so the layer
 * gain and the sound gains cannot disagree. Without `source.dialogueLufs` the
 * file's absolute `gainDb` is the fallback, because a guessed loudness would be
 * worse than a known-quiet one.
 */
export function deriveSfxDetail(
  plan: EditPlan,
  templates: Map<string, TemplateEntry>,
  sfxIndex: SfxIndex,
  /** Each template's measured impact, in seconds from the element's start. */
  impacts: Map<string, number> = new Map(),
  /** The reel's integrated dialogue loudness, when it has been measured. */
  dialogueLufs: number | undefined = undefined,
  /** The reel's true peak, when it has been measured. */
  dialoguePeakDbfs: number | undefined = undefined,
): SfxDerivation {
  const attenuationDb =
    dialogueLufs === undefined || dialoguePeakDbfs === undefined
      ? 0
      : dialogueAttenuationDb({
          dialogueLufs,
          dialoguePeakDbfs,
          loudestOffsetDb: loudestBoundOffsetDb(templates),
        });
  const known = new Set(sfxIndex.sfx.map((s) => s.id));
  const events: SfxEvent[] = [];

  const elements: { id: string; start: number; templateId: string | null }[] = [
    ...plan.subtitles.groups.map((g) => ({ id: g.id, start: g.start, templateId: g.templateId })),
    ...plan.keywords.items.map((k) => ({ id: k.id, start: k.start, templateId: k.templateId })),
    ...plan.images.slots.map((s) => ({ id: s.id, start: s.start, templateId: s.templateId })),
  ];

  const sounded = new Set<string>();
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
        sounded.add(element.id);
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

      sounded.add(element.id);
      events.push({
        id: 'pending',
        sourceElementId: element.id,
        sfxId: binding.sfxId,
        timeS: placed.inPointS,
        gainDb:
          dialogueLufs === undefined
            ? measured.gainDb
            : sfxGainDb({
                sfxId: binding.sfxId,
                filePeakDbfs: measured.peakDbfs,
                dialogueLufs,
                attenuationDb,
              }),
        anchorAtS: Number(placed.peakAtS.toFixed(6)),
        ...(placed.clamped ? { clamped: true, clampedByS: placed.clampedByS } : {}),
      });
    }
  }

  /*
   * Only slots that have a template: one without is not a silent image, it is
   * an absent one — the builder drops it and `checkBuildability` names it. The
   * plan legitimately passes through that state before templates are assigned.
   */
  const silent = plan.images.slots
    .filter((s) => s.templateId !== null && !sounded.has(s.id))
    .map((s) => s.id);
  if (silent.length > 0) throw new SilentImageSlotError(silent);

  events.sort((a, b) => a.timeS - b.timeS || (a.sourceElementId < b.sourceElementId ? -1 : 1));
  return {
    events: events.map((e, i) => ({ ...e, id: `sfx${String(i + 1).padStart(3, '0')}` })),
  };
}

/** The events alone, which is all any caller but the migration needs. */
export function deriveSfxEvents(
  plan: EditPlan,
  templates: Map<string, TemplateEntry>,
  sfxIndex: SfxIndex,
  impacts: Map<string, number> = new Map(),
  dialogueLufs: number | undefined = undefined,
  dialoguePeakDbfs: number | undefined = undefined,
): SfxEvent[] {
  return deriveSfxDetail(plan, templates, sfxIndex, impacts, dialogueLufs, dialoguePeakDbfs)
    .events;
}
