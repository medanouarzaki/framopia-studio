import path from 'node:path';
import {
  SUBTITLE_ANCHOR_BASELINE_Y,
  SUBTITLE_ANCHOR_X,
  type AuditLayer,
} from '@framopia/core';
import type { EditPlan, SubtitleGroup } from '../editplan/types.js';
import { displayWindow } from '../analysis/display-timing.js';
import { chooseBreak, type BreakCandidate } from './wrap.js';
import type { TextStyle } from './text-style.js';
import { shortCardTiming } from './short-card.js';
import { FRAME_WIDTH } from '../placement/constants.js';

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
  /** Anchor point, in source pixels, putting the content's centre on the layer's position. */
  contentAnchor?: { x: number; y: number };
  /** The card frame's colour, as three floats in 0..1 for After Effects. */
  cardColor?: [number, number, number];
  /**
   * Text layers carrying a copy of this card's word, drawn behind it.
   *
   * Declared by the template, filled with the same word, font and size, and
   * **never given a colour** — the shadow's own is the design.
   */
  shadowLayers?: string[];
  /**
   * The face, size and colour this card is set in.
   *
   * Absent for a client with no measured font names, and then the template's
   * own type is left alone — which is what every build did before. Never
   * guessed: After Effects accepts a name it cannot resolve and substitutes
   * silently, so a guess sets the wrong type without failing.
   */
  textStyle?: TextStyle;
}

export interface ReelPlacement {
  elementId: string;
  /** Layer time stretch, so a short card still gets a readable entrance. */
  stretchPercent?: number;
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

/**
 * How large the images are placed, as a multiplier on the plan's own scale.
 *
 * A parameter rather than a constant because Block 7 session 6 ruled the
 * images too small and nothing should be locked before the user has compared
 * them on screen. `a` is what the plan carries; the others are measured
 * ceilings from `npm run image-size`.
 */
export type ImageSizeVariant = 'strict' | 'loose' | 'face';

export interface ReelBuild {
  elements: ReelElement[];
  placementsA: ReelPlacement[];
  placementsC: ReelPlacement[];
  audio: { id: string; sfxId: string; sourceElementId: string; filePath: string; timeS: number; gainDb: number }[];
  skipped: Skipped[];
  shortened: { id: string; stretchPercent: number; introS: number; onFloor: boolean }[];
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
  minHoldFor?: (templateId: string) => number;
  sfxFileFor: (sfxId: string) => string;
  candidateFileFor: (slotId: string) => { path: string; id: string } | null;
  /** Where the top-left rule put this slot, in frame fractions. */
  topLeftFor?: (slotId: string) => { x: number; y: number; w: number; h: number } | undefined;
  /** Forced template for every image slot; the user ruled every image framed. */
  cardTemplateId?: string;
  /** The face, size and colour for one card. Absent leaves the template's own. */
  textStyleFor?: (card: { id: string; kind: 'subtitle' | 'keyword'; templateId: string }) => TextStyle | undefined;
  /** The shadow layers a template declares, filled with the same word. */
  shadowLayersFor?: (templateId: string) => string[];
  /** Extra placements, each a copy of the image set at a different size. */
  imageVariants?: {
    name: ImageSizeVariant;
    scaleFor: (slotId: string) => number;
    /** Where the ceiling found room, in frame fractions. Falls back to the solved centre. */
    rectFor?: (slotId: string) => { x: number; y: number; w: number; h: number } | undefined;
  }[];
}): ReelBuild {
  const { plan, audit, introFor, minHoldFor, sfxFileFor, candidateFileFor, topLeftFor, cardTemplateId } = options;
  const styleFor = options.textStyleFor ?? ((): undefined => undefined);
  const shadowsFor = options.shadowLayersFor ?? ((): string[] => []);
  const shortened: { id: string; stretchPercent: number; introS: number; onFloor: boolean }[] = [];

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
  const holdFor = (templateId: string): number => minHoldFor?.(templateId) ?? 0;
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
      ...(styleFor(card) === undefined ? {} : { textStyle: styleFor(card) as TextStyle }),
      ...(shadowsFor(card.templateId).length === 0
        ? {}
        : { shadowLayers: shadowsFor(card.templateId) }),
    });
    const inPointS = inPoints[i] as number;
    // A card too short for the standard entrance gets a faster one rather than
    // no entrance at all; the instance is time-stretched, never re-keyframed.
    const timing = shortCardTiming({
      cardDurationS: card.endS - card.startS,
      introS: introFor(card.templateId),
      minHoldS: holdFor(card.templateId),
    });
    if (timing.stretchPercent < 100) shortened.push({ id: card.id, ...timing });
    placementsA.push({
      elementId: card.id, kind: card.kind, inPointS, outPointS: card.endS,
      positionX: pos.x, positionY: pos.y, stretchPercent: timing.stretchPercent,
    });
    // C: the earlier card yields to the next card's intro.
    const nextIn = inPoints[i + 1];
    placementsC.push({
      elementId: card.id, kind: card.kind, inPointS,
      outPointS: nextIn === undefined ? card.endS : Math.min(card.endS, nextIn),
      positionX: pos.x, positionY: pos.y, stretchPercent: timing.stretchPercent,
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
    const c = comp(audit, cardTemplateId ?? slot.templateId);
    // Fails here rather than halfway through a build: the caller derives the
    // placeholder scale from this and a stale audit would leave the image at
    // the template's 100%, rendering it at the source's own size.
    auditedSolid(c, 'IMG_MAIN');
    elements.push({
      id: slot.id,
      kind: 'image',
      templateId: cardTemplateId ?? slot.templateId,
      placeholder: 'IMG_MAIN',
      imagePath: chosen.path,
    });

    /*
     * Top-left, on every reel (Block 7 session 9's ruling). The rect arrives
     * computed from the slot's own face-mask span; without one the solved zone
     * placement is used, so a reel with no masks still builds.
     */
    const placed = topLeftFor?.(slot.id);
    const scalePercent = placed === undefined
      ? slot.scale * 100
      : (placed.w * FRAME_WIDTH) / c.width * 100;
    const positionX = placed === undefined
      ? slot.position.x * plan.source.width + (c.width * slot.scale) / 2
      : (placed.x + placed.w / 2) * plan.source.width;
    const positionY = placed === undefined
      ? slot.position.y * plan.source.height + (c.width * slot.scale) / 2
      : (placed.y + placed.h / 2) * plan.source.height;

    const placement: ReelPlacement = {
      elementId: slot.id, kind: 'image', inPointS: slot.start, outPointS: slot.end,
      positionX, positionY, scalePercent,
    };
    placementsA.push(placement);
    placementsC.push({ ...placement });
  }

  const audio = plan.sfx.events.map((e) => ({
    id: e.id,
    sfxId: e.sfxId,
    sourceElementId: e.sourceElementId,
    filePath: sfxFileFor(e.sfxId),
    timeS: e.timeS,
    gainDb: e.gainDb,
  }));

  return { elements, placementsA, placementsC, audio, skipped, shortened };
}

export function resolveSfxDir(repoRoot: string): string {
  return path.join(repoRoot, 'assets', 'sfx');
}
