import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  MODES_DIR,
  PALETTE_MEANING,
  paletteRolesInDisplayOrder,
  REPO_ROOT,
  STANDARD_FONTS,
  clientDefaults,
  parseMode,
  type ClientMode,
} from '@framopia/core';
import { loadReels as loadFootageReels } from './frames/footage.js';
import { knownVideos, rememberVideo } from './videos.js';
import { editPlanPathFor } from './editplan/io.js';
import { listClientVideos, type FolderListing } from './clients/videos.js';

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
  /**
   * What **he** wrote about them, so a name alone is not all there is in a
   * year. The file's own `note` is the maintainer's and never leaves here.
   */
  about?: string;
  /** What the client looks like, so the panel can show it rather than say it. */
  look: {
    palette: { role: string; hex: string; what: string }[];
    fonts: { latin: string; arabic: string; standard: boolean };
    logoPath: string | null;
  };
  /** The values a build would use, and whether each is theirs or the standard. */
  standards: {
    language: string;
    videoShape: string;
    watermark: boolean;
    subtitleBaselineY: number;
    chosen: string[];
  };
  /** Whether their videos come from a folder of their own or from the old list. */
  hasFolder: boolean;
  /**
   * The client's own photographs, so the client screen can show and edit them.
   * The path travels to the panel because the panel draws the thumbnail from
   * the file where it sits; nothing copies it and nothing sends it onward.
   */
  pictures: { id: string; path: string; description: string; label?: string }[];
  /**
   * The values as they actually stand on the file, for the card that edits
   * them.
   *
   * **`look` and `standards` are for reading and this is for writing**, and the
   * two are not the same: `standards` resolves every blank to the value in
   * force, so a client who set nothing reads as `mixed` and `vertical` — and an
   * editor built on that would save those as choices the moment anything else
   * was touched. Absent here means the client never named one.
   *
   * **Schema addition, optional with a default**: a panel reading an older
   * service finds it missing and hides the editor rather than offering a
   * control that would fail on the first press, which is what
   * `pictures === undefined` already does one field above.
   */
  editable: {
    name: string;
    about?: string;
    videoFolder?: string;
    logoPath?: string;
    language?: string;
    videoShape?: string;
    subtitleBaselineY?: number;
    watermarkByDefault?: boolean;
    fonts?: { latin: string; arabic: string; emphasis?: string };
  };
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



/**
 * What is on the file, exactly, with nothing resolved.
 *
 * A field the client never named is absent here and stays absent: that is what
 * makes the card able to say *standard* and to leave it standard.
 */
function editableOf(mode: ClientMode): CatalogueMode['editable'] {
  const out: CatalogueMode['editable'] = { name: mode.name };
  if (mode.about !== undefined) out.about = mode.about;
  if (mode.videoFolder !== undefined) out.videoFolder = mode.videoFolder;
  if (mode.logoPath !== undefined) out.logoPath = mode.logoPath;
  if (mode.language !== undefined) out.language = mode.language;
  if (mode.videoShape !== undefined) out.videoShape = mode.videoShape;
  if (mode.subtitleBaselineY !== undefined) out.subtitleBaselineY = mode.subtitleBaselineY;
  if (mode.watermarkByDefault !== undefined) out.watermarkByDefault = mode.watermarkByDefault;
  if (mode.fonts.status === 'set') {
    out.fonts = {
      latin: mode.fonts.latin,
      arabic: mode.fonts.arabic,
      ...(mode.fonts.emphasis === undefined ? {} : { emphasis: mode.fonts.emphasis }),
    };
  }
  return out;
}

function standardsOf(mode: ClientMode): CatalogueMode['standards'] {
  const d = clientDefaults(mode);
  const chosen = Object.entries(d.source)
    .filter(([, from]) => from === 'client')
    .map(([field]) => field);
  return {
    language: d.language,
    videoShape: d.videoShape,
    watermark: d.watermark,
    subtitleBaselineY: d.subtitleBaselineY,
    chosen,
  };
}

/** One declaration, in `editplan/io.ts`, so nothing here can disagree with it. */
function planPathFor(videoPath: string): string {
  return editPlanPathFor(videoPath);
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
export async function describeVideo(videoPath: string): Promise<CatalogueReel> {
  /*
   * Opening a video **writes it down**, and that is the whole of the fix for a
   * client's reel being refused. Every later call — the steps, the dry run, the
   * run itself — sends only a label, and until now nothing on this side
   * remembered what a browsed label meant, so the lookup fell through to the
   * five test reels and refused by name. `rememberVideo` also reads the
   * duration, the shape and the hash the catalogue would otherwise have
   * supplied, and refuses with a sentence when the file cannot be used.
   */
  const known = await rememberVideo(videoPath);
  return describe(known.label, known.path, known.durationS);
}

/**
 * Every reel this machine can be asked about: the five test reels, and every
 * video someone has opened through Browse.
 *
 * The corpus catalogue keeps its own job — the fetch note, the sha256 and the
 * byte count `npm run doctor` verifies are still only about those five — and
 * stops being the list that decides what the product may open.
 */
export function listReels(): CatalogueReel[] {
  const browsed = knownVideos().map((v) => describe(v.label, v.path, v.durationS));
  const corpus = corpusReels();
  const seen = new Set(corpus.map((r) => r.videoPath));
  return [...corpus, ...browsed.filter((r) => !seen.has(r.videoPath))];
}

function corpusReels(): CatalogueReel[] {
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
          look: {
            palette: paletteRolesInDisplayOrder().map((role) => ({
              role,
              hex: mode.palette[role],
              what: PALETTE_MEANING[role],
            })),
            fonts:
              mode.fonts.status === 'set'
                ? { latin: mode.fonts.latin, arabic: mode.fonts.arabic, standard: false }
                : { ...STANDARD_FONTS, standard: true },
            logoPath: mode.logoPath ?? null,
          },
          standards: standardsOf(mode),
          pictures: (mode.pictures ?? []).map((p) => ({ ...p })),
          editable: editableOf(mode),
        };
        if (mode.fonts.status === 'set') {
          entry.fonts = { latin: mode.fonts.latin, arabic: mode.fonts.arabic };
        }
        if (mode.about !== undefined) entry.about = mode.about;
        return [entry];
      } catch {
        return [];
      }
    });
}

export { REPO_ROOT };
