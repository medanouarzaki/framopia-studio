import path from 'node:path';
import {
  SUBTITLE_ANCHOR_BASELINE_Y,
  SUBTITLE_ANCHOR_X,
  type AuditLayer,
} from '@framopia/core';
import type { EditPlan, SubtitleGroup } from '../editplan/types.js';
import { displayWindow } from '../analysis/display-timing.js';
import { chooseBreak, type BreakCandidate } from './wrap.js';

/**
 * Turns a plan into the element list and per-master placements the reel
 * builder places. All of it is arithmetic over the plan, the manifest and the
 * audit — After Effects makes no decisions.
 */
export interface AuditComp {
  name: string;
  width: number;
  height: number;
  layers: AuditLayer[];
}

export interface ReelElement {
  id: string;
  kind: 'subtitle' | 'keyword' | 'image';
  templateId: string;
  placeholder: string;
  text?: string;
  /** Where a break would go if AE's measurement says one is needed. */
  candidate?: BreakCandidate;
  imagePath?: string;
  placeholderScalePercent?: number;
}

export interface ReelPlacement {
  elementId: string;
  kind: 'subtitle' | 'keyword' | 'image';
  inPointS: number;
  outPointS: number;
  positionX: number;
  positionY: number;
  scalePercent?: number;
}

export interface Skipped {
  id: string;
  kind: string;
  reason: string;
}

function comp(audit: AuditComp[], id: string): AuditComp {
  const c = audit.find((x) => x.name === id);
  if (c === undefined) throw new Error(`templates/library.audit.json has no comp "${id}"`);
  return c;
}

function layerOf(c: AuditComp, name: string): AuditLayer {
  const l = c.layers.find((x) => x.name === name);
  if (l === undefined) throw new Error(`comp "${c.name}" has no layer "${name}"`);
  return l;
}

function settled(l: AuditLayer, field: 'position' | 'anchorPoint' | 'scale'): number[] {
  const v = l[field]?.valueAtSampleTime;
  if (!Array.isArray(v)) {
    throw new Error(`layer "${l.name}" has no audited ${field}; run npm run audit:templates`);
  }
  return v as number[];
}

/**
 * Where a text comp layer must sit so its placeholder's baseline lands on the
 * global anchor. The comp layer's anchor defaults to the comp centre, which is
 * measured from the audit rather than assumed.
 */
export function textCompPosition(c: AuditComp, placeholder: string): { x: number; y: number } {
  const baseline = settled(layerOf(c, placeholder), 'position');
  const anchorX = c.width / 2;
  const anchorY = c.height / 2;
  return {
    x: SUBTITLE_ANCHOR_X - ((baseline[0] as number) - anchorX),
    y: SUBTITLE_ANCHOR_BASELINE_Y - ((baseline[1] as number) - anchorY),
  };
}

/**
 * What scale the replaced placeholder needs so the image occupies the
 * footprint the template's solid did.
 *
 * A replaced layer takes the source's dimensions — a 1000 px solid becomes a
 * 2048 px image at an unchanged 100%, rendering at 171% of a 1200 px comp. The
 * factor is the audited solid size over the real source size, times whatever
 * scale the template already declared, so a template that scales its
 * placeholder keeps doing so.
 */
export function placeholderScalePercent(options: {
  auditedSolidWidth: number;
  auditedScalePercent: number;
  sourceWidth: number;
}): number {
  const { auditedSolidWidth, auditedScalePercent, sourceWidth } = options;
  if (sourceWidth <= 0) throw new Error('source width must be positive');
  return (auditedSolidWidth / sourceWidth) * auditedScalePercent;
}

export function auditedSolid(c: AuditComp, placeholder: string): {
  width: number;
  scalePercent: number;
} {
  const l = layerOf(c, placeholder);
  if (typeof l.width !== 'number') {
    throw new Error(`layer "${placeholder}" has no audited width; run npm run audit:templates`);
  }
  return { width: l.width, scalePercent: settled(l, 'scale')[0] as number };
}

export interface ReelBuild {
  elements: ReelElement[];
  placementsA: ReelPlacement[];
  placementsC: ReelPlacement[];
  audio: { id: string; filePath: string; timeS: number; gainDb: number }[];
  skipped: Skipped[];
}

/**
 * `A` is TEMPLATE_LIBRARY_GUIDE §5 as written: the intro ends when the card
 * should be fully on, so the layer starts `introS` early and two cards overlap
 * at every transition. `C` keeps the same in-points and lets the earlier card
 * yield, so nothing ever overlaps. The two differ in that and nothing else.
 */
export function buildReel(options: {
  plan: EditPlan;
  audit: AuditComp[];
  introFor: (templateId: string) => number;
  sfxFileFor: (sfxId: string) => string;
  candidateFileFor: (slotId: string) => { path: string; id: string } | null;
}): ReelBuild {
  const { plan, audit, introFor, sfxFileFor, candidateFileFor } = options;
  const elements: ReelElement[] = [];
  const placementsA: ReelPlacement[] = [];
  const placementsC: ReelPlacement[] = [];
  const skipped: Skipped[] = [];

  const wordText = new Map(plan.transcript.words.map((w) => [w.id, w.text]));
  const superseded = new Set(
    plan.subtitles.groups.filter((g) => g.supersededBy != null).map((g) => g.id),
  );

  interface TextCard {
    id: string;
    kind: 'subtitle' | 'keyword';
    templateId: string;
    text: string;
    startS: number;
    endS: number;
  }

  const cards: TextCard[] = [];
  for (const g of plan.subtitles.groups) {
    if (superseded.has(g.id)) continue;
    if (g.templateId === null) {
      skipped.push({ id: g.id, kind: 'subtitle', reason: 'no templateId' });
      continue;
    }
    if (g.displayStart === undefined || g.displayEnd === undefined) {
      skipped.push({ id: g.id, kind: 'subtitle', reason: 'no display timing on the plan' });
      continue;
    }
    const w = displayWindow(g as SubtitleGroup);
    cards.push({
      id: g.id,
      kind: 'subtitle',
      templateId: g.templateId,
      text: g.wordIds.map((id) => wordText.get(id) ?? '').join(' '),
      startS: w.start,
      endS: w.end,
    });
  }
  for (const k of plan.keywords.items) {
    if (k.templateId === null) {
      skipped.push({ id: k.id, kind: 'keyword', reason: 'no templateId' });
      continue;
    }
    cards.push({
      id: k.id,
      kind: 'keyword',
      templateId: k.templateId,
      text: k.text,
      startS: k.start,
      endS: k.end,
    });
  }
  cards.sort((a, b) => a.startS - b.startS || (a.id < b.id ? -1 : 1));

  const inPoints = cards.map((c) => c.startS - introFor(c.templateId));
  cards.forEach((card, i) => {
    const c = comp(audit, card.templateId);
    const pos = textCompPosition(c, 'TXT_MAIN');
    elements.push({
      id: card.id,
      kind: card.kind,
      templateId: card.templateId,
      placeholder: 'TXT_MAIN',
      text: card.text,
      candidate: chooseBreak(card.text),
    });
    const inPointS = inPoints[i] as number;
    placementsA.push({
      elementId: card.id, kind: card.kind, inPointS, outPointS: card.endS,
      positionX: pos.x, positionY: pos.y,
    });
    // C: the earlier card yields to the next card's intro.
    const nextIn = inPoints[i + 1];
    placementsC.push({
      elementId: card.id, kind: card.kind, inPointS,
      outPointS: nextIn === undefined ? card.endS : Math.min(card.endS, nextIn),
      positionX: pos.x, positionY: pos.y,
    });
  });

  for (const slot of plan.images.slots) {
    if (slot.templateId === null) {
      skipped.push({ id: slot.id, kind: 'image', reason: 'no templateId' });
      continue;
    }
    if (slot.position == null || slot.scale == null) {
      skipped.push({ id: slot.id, kind: 'image', reason: 'no Block 5 placement' });
      continue;
    }
    const chosen = candidateFileFor(slot.id);
    if (chosen === null) {
      skipped.push({ id: slot.id, kind: 'image', reason: 'no candidate file on disk' });
      continue;
    }
    const c = comp(audit, slot.templateId);
    // Fails here rather than halfway through a build: the caller derives the
    // placeholder scale from this and a stale audit would leave the image at
    // the template's 100%, rendering it at the source's own size.
    auditedSolid(c, 'IMG_MAIN');
    elements.push({
      id: slot.id,
      kind: 'image',
      templateId: slot.templateId,
      placeholder: 'IMG_MAIN',
      imagePath: chosen.path,
    });

    // The plan's scale is a fraction of the template comp's side; its position
    // is the placed rect's top-left as a fraction of the frame. A comp layer is
    // anchored at its centre, so half the placed size is added back.
    const scalePercent = slot.scale * 100;
    const placedPx = c.width * slot.scale;
    const positionX = slot.position.x * plan.source.width + placedPx / 2;
    const positionY = slot.position.y * plan.source.height + placedPx / 2;
    const placement: ReelPlacement = {
      elementId: slot.id, kind: 'image', inPointS: slot.start, outPointS: slot.end,
      positionX, positionY, scalePercent,
    };
    placementsA.push(placement);
    placementsC.push({ ...placement });
  }

  const audio = plan.sfx.events.map((e) => ({
    id: e.id,
    filePath: sfxFileFor(e.sfxId),
    timeS: e.timeS,
    gainDb: e.gainDb,
  }));

  return { elements, placementsA, placementsC, audio, skipped };
}

export function resolveSfxDir(repoRoot: string): string {
  return path.join(repoRoot, 'assets', 'sfx');
}
