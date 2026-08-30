import type { TemplateEntry } from './templates.js';

/**
 * The shape of a built composition, reduced to what a comparison needs.
 *
 * After Effects is asked what is really in the project (`tools/ae/census.jsx`)
 * and this turns that dump into a document. The split is the one
 * `validateTemplates` already uses: everything that can be decided without
 * After Effects is decided here, so it is exercised by `npm run check`, and
 * the ExtendScript stays a reader.
 *
 * **The summary is derived, never asserted.** A census that carried a
 * hand-written "0 placeholder words survive" would be the defect Block 9 spent
 * a session on: a claim nothing checks. Every count below is computed from the
 * layers in the dump.
 */
export const COMP_CENSUS_SCHEMA_VERSION = 1;

/** A template's placeholder word, left behind when a build does not fill it. */
export interface RawTextInfo {
  text?: string | null;
  font?: string | null;
  fontSize?: number;
  tracking?: number;
  leading?: number | null;
  autoLeading?: boolean;
  fillColor?: [number, number, number] | null;
  applyFill?: boolean;
}

export interface RawLayer extends RawTextInfo {
  name: string;
  index: number;
  kind: string;
  enabled?: boolean | null;
  inPoint?: number | null;
  outPoint?: number | null;
  startTime?: number | null;
  stretch?: number | null;
  parentName?: string | null;
  sourceName?: string | null;
  sourceIsComp?: boolean;
  sourceFile?: string | null;
  alphaMode?: number | null;
  position?: [number, number] | null;
  scale?: [number, number] | null;
  anchorPoint?: [number, number] | null;
  hasAudio?: boolean;
  audioLevelDb?: [number, number] | null;
}

export interface RawComp {
  name: string;
  width: number;
  height: number;
  duration: number;
  frameRate: number;
  numLayers: number;
  layers: RawLayer[];
}

export interface RawCensus {
  ok: boolean;
  stage?: string;
  message?: string;
  aeVersion?: string;
  projectFile?: string | null;
  projectDirty?: boolean;
  numItems?: number;
  fontNameCount?: number | null;
  comps?: RawComp[];
  footageItems?: { name: string; file: string | null; width: number; height: number }[];
}

export class CompCensusError extends Error {}

/**
 * How a built element comp is named: `<element id>__<template id>`.
 *
 * `build-reel.jsx` writes it and nothing else in a built project carries a
 * double underscore, so it is what separates a duplicated instance from the
 * six library comps the import brought along.
 */
export const ELEMENT_COMP_SEPARATOR = '__';

export interface ElementComp {
  compName: string;
  elementId: string;
  templateId: string;
}

export function parseElementComp(compName: string): ElementComp | null {
  const at = compName.indexOf(ELEMENT_COMP_SEPARATOR);
  if (at <= 0) return null;
  const elementId = compName.slice(0, at);
  const templateId = compName.slice(at + ELEMENT_COMP_SEPARATOR.length);
  if (templateId === '' || templateId.includes(ELEMENT_COMP_SEPARATOR)) return null;
  return { compName, elementId, templateId };
}

export interface TextCompCensus {
  compName: string;
  elementId: string;
  templateId: string;
  /** Every layer in the comp, by exact name, in layer order. */
  layerNames: string[];
  /** Declared placeholders and shadows that are missing from the comp. */
  missingDeclared: string[];
  /** Layers holding text that the template declares neither way. */
  undeclaredTextLayers: string[];
  layers: {
    name: string;
    role: 'placeholder' | 'shadow' | 'undeclared';
    text: string | null;
    font: string | null;
    fontSize: number | null;
    tracking: number | null;
    fillColor: [number, number, number] | null;
  }[];
  /** Placeholder and shadow carrying different strings is a filling defect. */
  placeholderShadowAgree: boolean | null;
}

export type MasterLayerRole = 'footage' | 'watermark' | 'sfx' | 'image' | 'text' | 'unknown';

export interface MasterLayerCensus {
  index: number;
  name: string;
  role: MasterLayerRole;
  sourceName: string | null;
  sourceFile: string | null;
  templateId: string | null;
  inPoint: number | null;
  outPoint: number | null;
  startTime: number | null;
  stretch: number | null;
  position: [number, number] | null;
  scale: [number, number] | null;
  alphaMode: number | null;
  audioLevelDb: [number, number] | null;
}

export interface MasterCensus {
  name: string;
  width: number;
  height: number;
  duration: number;
  frameRate: number;
  numLayers: number;
  layers: MasterLayerCensus[];
  roleCounts: Record<MasterLayerRole, number>;
}

export interface CompCensusSummary {
  compCount: number;
  masterCount: number;
  elementCompCount: number;
  libraryCompCount: number;
  textCompCount: number;
  textLayersChecked: number;
  /** Text layers still carrying a word the template shipped with. */
  placeholderWordsSurviving: number;
  compsWithMissingDeclaredLayer: number;
  compsWithUndeclaredTextLayer: number;
  compsWherePlaceholderAndShadowDiffer: number;
  fontsSeen: string[];
  /** Fonts on a text layer that the caller did not list as expected. */
  unexpectedFonts: string[];
  emptyTextLayers: number;
}

export interface CompCensus {
  schemaVersion: number;
  tool: string;
  toolVersion: number;
  measuredAt: string;
  aepPath: string;
  aepSha256: string;
  aeVersion: string;
  projectDirty: boolean;
  numItems: number;
  fontNameCount: number | null;
  masters: MasterCensus[];
  textComps: TextCompCensus[];
  summary: CompCensusSummary;
}

export interface ShapeCensusInputs {
  raw: RawCensus;
  aepPath: string;
  aepSha256: string;
  measuredAt: string;
  templates: TemplateEntry[];
  /**
   * The words the templates ship with. A build fills by exact layer name, so a
   * layer it never reached still reads one of these — which is how a hand-made
   * duplicate of `TXT_MAIN` came one build away from putting `kan9olo` on every
   * card of every reel.
   */
  placeholderWords: string[];
  /** PostScript names this client declares. A font outside it is reported. */
  expectedFonts?: string[];
  /** How a master comp is recognised. `build-reel.jsx` names them `master_*`. */
  masterPrefix?: string;
}

export const MASTER_COMP_PREFIX = 'master';

function roleOf(layer: RawLayer, templates: Map<string, TemplateEntry>): MasterLayerRole {
  if (layer.sourceIsComp === true) {
    const parsed = parseElementComp(layer.sourceName ?? '');
    const entry = parsed === null ? undefined : templates.get(parsed.templateId);
    if (entry?.type === 'image') return 'image';
    if (entry?.type === 'subtitle' || entry?.type === 'keyword') return 'text';
    return 'unknown';
  }
  const file = layer.sourceFile;
  if (file === null || file === undefined) return 'unknown';
  const lower = file.toLowerCase();
  if (lower.endsWith('.wav') || lower.endsWith('.mp3') || lower.endsWith('.aif')) return 'sfx';
  /*
   * The watermark and the reel are both QuickTime, so the extension cannot
   * separate them. The watermark is the one asset in the repository, and the
   * reel is footage from outside it; matching on the directory is what the
   * plan itself distinguishes them by.
   */
  if (lower.includes('/assets/watermark/')) return 'watermark';
  return 'footage';
}

function templateIdOf(layer: RawLayer): string | null {
  if (layer.sourceIsComp !== true) return null;
  return parseElementComp(layer.sourceName ?? '')?.templateId ?? null;
}

function emptyRoleCounts(): Record<MasterLayerRole, number> {
  return { footage: 0, watermark: 0, sfx: 0, image: 0, text: 0, unknown: 0 };
}

export function shapeCensus(inputs: ShapeCensusInputs): CompCensus {
  const { raw } = inputs;
  if (raw.ok !== true) {
    throw new CompCensusError(
      `After Effects refused the census at ${raw.stage ?? 'an unnamed stage'}: ` +
        `${raw.message ?? 'no reason given'}`,
    );
  }
  const comps = raw.comps ?? [];
  const templates = new Map(inputs.templates.map((t) => [t.id, t]));
  const masterPrefix = inputs.masterPrefix ?? MASTER_COMP_PREFIX;
  const placeholderWords = new Set(inputs.placeholderWords);
  const expected = inputs.expectedFonts === undefined ? null : new Set(inputs.expectedFonts);

  const masters: MasterCensus[] = [];
  const textComps: TextCompCensus[] = [];
  let elementCompCount = 0;
  let libraryCompCount = 0;
  let textLayersChecked = 0;
  let placeholderWordsSurviving = 0;
  let emptyTextLayers = 0;
  const fontsSeen = new Set<string>();

  for (const c of comps) {
    if (c.name.startsWith(masterPrefix)) {
      const layers = c.layers.map((l) => ({
        index: l.index,
        name: l.name,
        role: roleOf(l, templates),
        sourceName: l.sourceName ?? null,
        sourceFile: l.sourceFile ?? null,
        templateId: templateIdOf(l),
        inPoint: l.inPoint ?? null,
        outPoint: l.outPoint ?? null,
        startTime: l.startTime ?? null,
        stretch: l.stretch ?? null,
        position: l.position ?? null,
        scale: l.scale ?? null,
        alphaMode: l.alphaMode ?? null,
        audioLevelDb: l.audioLevelDb ?? null,
      }));
      const roleCounts = emptyRoleCounts();
      for (const l of layers) roleCounts[l.role] += 1;
      masters.push({
        name: c.name,
        width: c.width,
        height: c.height,
        duration: c.duration,
        frameRate: c.frameRate,
        numLayers: c.numLayers,
        layers,
        roleCounts,
      });
      continue;
    }

    const parsed = parseElementComp(c.name);
    if (parsed === null) {
      libraryCompCount += 1;
      continue;
    }
    elementCompCount += 1;
    const entry = templates.get(parsed.templateId);
    if (entry === undefined || (entry.type !== 'subtitle' && entry.type !== 'keyword')) continue;

    const declaredPlaceholders = new Set(entry.placeholders);
    const declaredShadows = new Set(entry.shadowLayers ?? []);
    const layerNames = c.layers.map((l) => l.name);
    const present = new Set(layerNames);
    const missingDeclared = [...declaredPlaceholders, ...declaredShadows].filter(
      (n) => !present.has(n),
    );

    const undeclaredTextLayers: string[] = [];
    const layers: TextCompCensus['layers'] = [];
    for (const l of c.layers) {
      if (l.kind !== 'text') continue;
      textLayersChecked += 1;
      const role = declaredPlaceholders.has(l.name)
        ? 'placeholder'
        : declaredShadows.has(l.name)
          ? 'shadow'
          : 'undeclared';
      if (role === 'undeclared') undeclaredTextLayers.push(l.name);
      const text = l.text ?? null;
      if (text !== null && placeholderWords.has(text)) placeholderWordsSurviving += 1;
      if (text === null || text === '') emptyTextLayers += 1;
      if (typeof l.font === 'string') fontsSeen.add(l.font);
      layers.push({
        name: l.name,
        role,
        text,
        font: l.font ?? null,
        fontSize: l.fontSize ?? null,
        tracking: l.tracking ?? null,
        fillColor: l.fillColor ?? null,
      });
    }

    const placeholderTexts = layers.filter((l) => l.role === 'placeholder').map((l) => l.text);
    const shadowTexts = layers.filter((l) => l.role === 'shadow').map((l) => l.text);
    const agree =
      placeholderTexts.length === 0 || shadowTexts.length === 0
        ? null
        : shadowTexts.every((t) => t === placeholderTexts[0]);

    textComps.push({
      compName: c.name,
      elementId: parsed.elementId,
      templateId: parsed.templateId,
      layerNames,
      missingDeclared,
      undeclaredTextLayers,
      layers,
      placeholderShadowAgree: agree,
    });
  }

  const sortedFonts = [...fontsSeen].sort();
  const summary: CompCensusSummary = {
    compCount: comps.length,
    masterCount: masters.length,
    elementCompCount,
    libraryCompCount,
    textCompCount: textComps.length,
    textLayersChecked,
    placeholderWordsSurviving,
    compsWithMissingDeclaredLayer: textComps.filter((t) => t.missingDeclared.length > 0).length,
    compsWithUndeclaredTextLayer: textComps.filter((t) => t.undeclaredTextLayers.length > 0)
      .length,
    compsWherePlaceholderAndShadowDiffer: textComps.filter((t) => t.placeholderShadowAgree === false)
      .length,
    fontsSeen: sortedFonts,
    unexpectedFonts: expected === null ? [] : sortedFonts.filter((f) => !expected.has(f)),
    emptyTextLayers,
  };

  return {
    schemaVersion: COMP_CENSUS_SCHEMA_VERSION,
    tool: 'tools/ae/census.jsx',
    toolVersion: COMP_CENSUS_SCHEMA_VERSION,
    measuredAt: inputs.measuredAt,
    aepPath: inputs.aepPath,
    aepSha256: inputs.aepSha256,
    aeVersion: raw.aeVersion ?? 'unknown',
    projectDirty: raw.projectDirty ?? false,
    numItems: raw.numItems ?? 0,
    fontNameCount: raw.fontNameCount ?? null,
    masters,
    textComps,
    summary,
  };
}
