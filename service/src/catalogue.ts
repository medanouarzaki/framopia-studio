import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { MODES_DIR, parseMode, REPO_ROOT } from '@framopia/core';
import { loadReels as loadFootageReels } from './frames/footage.js';
import { VIDEO_EXTENSIONS, listClientVideos, type FolderListing } from './clients/videos.js';

/**
 * What the panel offers the user to pick from.
 *
 * It lives here rather than in the panel because the panel is a view: the rule
 * for where footage lives is `frames/footage.ts`, the rule for what a mode is
 * is `core/src/mode.ts`, and a second copy of either inside a React bundle is
 * a second place for them to drift. The panel asks over HTTP and renders the
 * answer.
 */
export interface CatalogueReel {
  label: string;
  videoPath: string;
  planPath: string | null;
  durationS: number | null;
  /** Cumulative spend from the plan's `costs.spentUsd`; null when no plan exists. */
  spentUsd: number | null;
  /** False when the catalogue lists it but the file is not on this machine. */
  present: boolean;
}

export interface CatalogueMode {
  id: string;
  name: string;
  version: number;
  fontsResolved: boolean;
  /** Present only when the mode names its own; the panel says which will render. */
  fonts?: { latin: string; arabic: string };
  /** What he wrote about them, so a name alone is not all there is in a year. */
  note?: string;
  /** Whether their videos come from a folder of their own or from the old list. */
  hasFolder: boolean;
}

/**
 * A client's videos, or the old hand-kept list when they have no folder.
 *
 * `benchmarks/footage.json` still works, so nothing that worked today stops:
 * the five corpus reels have no client folder behind them and list exactly as
 * they did.
 */
export interface VideoListing {
  reels: CatalogueReel[];
  /** The folder they came from, or null when they came from the old list. */
  folder: string | null;
  /** What the disk said, when it had nothing to give. */
  trouble: string | null;
  /** Files in the folder this tool will not offer, and why. Never hidden. */
  skipped: { name: string; why: string }[];
}

function planPathFor(videoPath: string): string {
  return videoPath.replace(/\.[^.]+$/, '.editplan.json');
}

/**
 * What a client's videos are, with everything the picker shows about each.
 *
 * A client with a folder gets the folder; a client without one — and every
 * client written before folders existed — gets `footage.json`, which is why
 * `k2-syndicalia` still lists the five corpus reels.
 */
export function listVideosFor(modeId: string | null): VideoListing {
  if (modeId === null) {
    return { reels: listReels(), folder: null, trouble: null, skipped: [] };
  }
  const listing: FolderListing = listClientVideos(modeId);
  if (listing.folder === null) {
    return { reels: listReels(), folder: null, trouble: null, skipped: [] };
  }
  return {
    reels: listing.videos.map((video) => describe(video.label, video.path, null)),
    folder: listing.folder,
    trouble: listing.trouble,
    skipped: listing.skipped,
  };
}

function describe(label: string, videoPath: string, durationS: number | null): CatalogueReel {
  const planPath = planPathFor(videoPath);
  const hasPlan = existsSync(planPath);
  let spentUsd: number | null = null;
  if (hasPlan) {
    try {
      const plan = JSON.parse(readFileSync(planPath, 'utf8')) as { costs?: { spentUsd?: number } };
      spentUsd = typeof plan.costs?.spentUsd === 'number' ? plan.costs.spentUsd : null;
    } catch {
      spentUsd = null;
    }
  }
  return {
    label,
    videoPath,
    planPath: hasPlan ? planPath : null,
    durationS,
    spentUsd,
    present: existsSync(videoPath),
  };
}

/**
 * One video, named directly. Browse hands a path from anywhere on the disk, so
 * this is the only entry point that does not come from a list — and the only
 * one that has to say why a file will not do rather than leaving it out.
 */
export function describeVideo(videoPath: string): CatalogueReel {
  if (!path.isAbsolute(videoPath)) {
    throw new Error('give the full path to the file');
  }
  if (!existsSync(videoPath)) {
    throw new Error(`there is nothing at ${videoPath}. If it is on an external disk, plug it in.`);
  }
  const extension = path.extname(videoPath).toLowerCase();
  if (!VIDEO_EXTENSIONS.includes(extension)) {
    throw new Error(`this tool does not open ${extension || 'files without an extension'}.`);
  }
  return describe(path.basename(videoPath).replace(/\.[^.]+$/, ''), videoPath, null);
}

export function listReels(): CatalogueReel[] {
  return loadFootageReels().map((reel) => {
    const planPath = planPathFor(reel.path);
    const hasPlan = existsSync(planPath);
    let spentUsd: number | null = null;
    if (hasPlan) {
      try {
        const plan = JSON.parse(readFileSync(planPath, 'utf8')) as { costs?: { spentUsd?: number } };
        spentUsd = typeof plan.costs?.spentUsd === 'number' ? plan.costs.spentUsd : null;
      } catch {
        // A plan that will not parse is a problem for the stage that opens it,
        // not a reason to drop the reel from the picker.
        spentUsd = null;
      }
    }
    return {
      label: reel.label,
      videoPath: reel.path,
      planPath: hasPlan ? planPath : null,
      durationS: reel.durationS ?? null,
      spentUsd,
      present: existsSync(reel.path),
    };
  });
}

/**
 * Every mode in `modes/`, through the same parser `npm run validate:modes`
 * uses, so a mode the validator rejects does not silently appear in a picker.
 */
export function listModes(): CatalogueMode[] {
  if (!existsSync(MODES_DIR)) return [];
  return readdirSync(MODES_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .flatMap((file) => {
      const modePath = path.join(MODES_DIR, file);
      try {
        const mode = parseMode(readFileSync(modePath, 'utf8'), modePath);
        const entry: CatalogueMode = {
          id: mode.id,
          name: mode.name,
          version: mode.version,
          fontsResolved: mode.fonts.status === 'set',
          hasFolder: mode.videoFolder !== undefined,
        };
        if (mode.fonts.status === 'set') {
          entry.fonts = { latin: mode.fonts.latin, arabic: mode.fonts.arabic };
        }
        if (mode.note !== undefined) entry.note = mode.note;
        return [entry];
      } catch {
        return [];
      }
    });
}

export { REPO_ROOT };
