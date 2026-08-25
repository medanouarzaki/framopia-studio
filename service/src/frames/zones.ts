import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';
import { runSidecar } from '../images/sidecar.js';
import { reelMasksDir } from './segment.js';
import { readFramesManifest } from './sample.js';

/** ARCHITECTURE §3's zones block, normalized 0-1 against the frame. */
export interface ZoneRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ZoneKind = 'top' | 'left' | 'right';
export const ZONE_KINDS: ZoneKind[] = ['top', 'left', 'right'];

export interface Zone {
  id: string;
  kind: ZoneKind;
  rect: ZoneRect;
  valid: [number, number][];
  manual: false;
}

export interface PerFrameZones {
  timeS: number;
  top: ZoneRect | null;
  left: ZoneRect | null;
  right: ZoneRect | null;
}

export interface ComputeZonesResult {
  ok: true;
  task: 'compute_zones';
  sampleFps: number | null;
  width: number;
  height: number;
  params: Record<string, number | null>;
  zones: Zone[];
  perFrame: PerFrameZones[];
  emptySamples: number;
}

export interface MaskComponent {
  label: number;
  areaPx: number;
  areaFrameFraction: number;
  areaMaskFraction: number;
  box: { x0: number; y0: number; x1: number; y1: number };
  dropped: boolean;
}

export interface ComponentStatsResult {
  ok: true;
  task: 'component_stats';
  componentFloor: number;
  frames: { maskPath: string; components: MaskComponent[] }[];
}

export const ZONES_DEBUG_DIR = path.join(REPO_ROOT, 'benchmarks', 'results', 'latest-zones');

/**
 * The source reels' geometry. The working masks are 540x960; a short edge is
 * quoted in source pixels because that is the frame an editor sees.
 */
export const SOURCE_WIDTH = 2160;
export const SOURCE_HEIGHT = 3840;
export const COMPONENTS_DEBUG_DIR = path.join(
  REPO_ROOT,
  'benchmarks',
  'results',
  'latest-components',
);

/**
 * The mask sequence for a reel, paired with the manifest's real presentation
 * timestamps. Validity windows are cut on these, never on index/sampleFps.
 */
export interface MaskFrame {
  index: number;
  timeS: number;
  framePath: string;
  binaryMaskPath: string;
  confidenceMaskPath: string;
}

export function maskFramesFor(reelPath: string): MaskFrame[] {
  const manifest = readFramesManifest(reelPath);
  const segmentation = readSegmentation(reelPath);
  if (segmentation.length !== manifest.frames.length) {
    throw new Error(
      `${segmentation.length} masks against ${manifest.frames.length} sampled frames`,
    );
  }
  return manifest.frames.map((frame, index) => {
    const mask = segmentation[index];
    if (!mask) throw new Error(`no mask for frame ${frame.index}`);
    return {
      index: frame.index,
      timeS: frame.timeS,
      framePath: mask.framePath,
      binaryMaskPath: mask.binaryMaskPath,
      confidenceMaskPath: mask.confidenceMaskPath,
    };
  });
}

interface SegmentationRecord {
  framePath: string;
  binaryMaskPath: string;
  confidenceMaskPath: string;
}

function readSegmentation(reelPath: string): SegmentationRecord[] {
  const file = path.join(reelMasksDir(reelPath), 'segmentation.json');
  const parsed = JSON.parse(readUtf8(file)) as { frames?: SegmentationRecord[] };
  if (!parsed.frames?.length) {
    throw new Error(`${file} lists no frames; run npm run segment first`);
  }
  return parsed.frames;
}

function readUtf8(file: string): string {
  return readFileSync(file, 'utf8');
}

export function computeZones(options: {
  frames: { maskPath: string; timeS: number }[];
  sampleFps: number;
  threshold?: number;
}): Promise<ComputeZonesResult> {
  return runSidecar<ComputeZonesResult>({
    task: 'compute_zones',
    frames: options.frames,
    sampleFps: options.sampleFps,
    threshold: options.threshold ?? null,
  });
}

export function componentStats(options: {
  maskPaths: string[];
  componentFloor?: number;
}): Promise<ComponentStatsResult> {
  return runSidecar<ComponentStatsResult>({
    task: 'component_stats',
    maskPaths: options.maskPaths,
    componentFloor: options.componentFloor,
  });
}

export interface ZoneSummary {
  kind: ZoneKind;
  count: number;
  meanRectArea: number;
  totalValidS: number;
}

export function summariseZones(zones: Zone[]): ZoneSummary[] {
  return ZONE_KINDS.map((kind) => {
    const of = zones.filter((zone) => zone.kind === kind);
    const area = of.reduce((sum, zone) => sum + zone.rect.w * zone.rect.h, 0);
    const seconds = of.reduce(
      (sum, zone) => sum + zone.valid.reduce((s, [start, end]) => s + (end - start), 0),
      0,
    );
    return {
      kind,
      count: of.length,
      meanRectArea: of.length ? area / of.length : 0,
      totalValidS: seconds,
    };
  });
}

export function totalValidSeconds(zones: Zone[]): number {
  return summariseZones(zones).reduce((sum, row) => sum + row.totalValidS, 0);
}
