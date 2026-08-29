import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { loadMode } from '@framopia/core';

/**
 * The videos a client has, read from their own folder.
 *
 * Until now the list came from `benchmarks/footage.json`, maintained by hand:
 * five test reels and nothing else, which is useless for real work. A client
 * names a folder and the list is what is in it.
 *
 * **Nothing watches the disk.** The T7 is not always plugged in, and a watcher
 * would have to decide what to do every time it vanished — a class of behaviour
 * worth getting right for something more than one click. Refresh is a button.
 * An absent disk is therefore discovered because he asked, and reported as a
 * fact about the disk rather than as a fault.
 */
export const VIDEO_EXTENSIONS = ['.mov', '.mp4', '.m4v', '.avi', '.mkv'];

export interface FolderVideo {
  label: string;
  path: string;
  /** Bytes, so an empty or truncated file is visible before anything reads it. */
  sizeBytes: number;
}

export interface FolderListing {
  folder: string | null;
  videos: FolderVideo[];
  /**
   * Files in the folder this tool will not offer, and why — never hidden. A
   * video that silently vanishes from a list is a video he goes looking for.
   */
  skipped: { name: string; why: string }[];
  /** What the disk said, in words, when there is nothing to list. */
  trouble: string | null;
}

export function listClientVideos(modeId: string): FolderListing {
  let folder: string | undefined;
  try {
    folder = loadMode(modeId).videoFolder;
  } catch {
    return { folder: null, videos: [], skipped: [], trouble: null };
  }
  if (folder === undefined) return { folder: null, videos: [], skipped: [], trouble: null };
  return listFolder(folder);
}

export function listFolder(folder: string): FolderListing {
  const empty = { folder, videos: [], skipped: [] };
  if (!existsSync(folder)) {
    return {
      ...empty,
      trouble:
        `${folder} is not there. If it is on an external disk, plug it in and press Refresh.`,
    };
  }
  let entries;
  try {
    if (!statSync(folder).isDirectory()) {
      return { ...empty, trouble: `${folder} is a file, not a folder.` };
    }
    entries = readdirSync(folder, { withFileTypes: true });
  } catch (error) {
    return { ...empty, trouble: `${folder} could not be read: ${(error as Error).message}` };
  }

  const videos: FolderVideo[] = [];
  const skipped: { name: string; why: string }[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) continue;
    const extension = path.extname(entry.name).toLowerCase();
    if (!VIDEO_EXTENSIONS.includes(extension)) {
      // Only worth mentioning for things that look like they might be video.
      if (/\.(webm|flv|wmv|mpg|mpeg|mts|m2ts|prproj|aep)$/i.test(entry.name)) {
        skipped.push({ name: entry.name, why: `this tool does not open ${extension} files` });
      }
      continue;
    }
    let sizeBytes = 0;
    try {
      sizeBytes = statSync(full).size;
    } catch {
      skipped.push({ name: entry.name, why: 'the file could not be read' });
      continue;
    }
    if (sizeBytes === 0) {
      skipped.push({ name: entry.name, why: 'the file is empty' });
      continue;
    }
    videos.push({ label: entry.name.replace(/\.[^.]+$/, ''), path: full, sizeBytes });
  }
  videos.sort((a, b) => (a.label < b.label ? -1 : 1));

  return {
    folder,
    videos,
    skipped,
    trouble:
      videos.length === 0 && skipped.length === 0
        ? `There are no videos in ${folder}.`
        : null,
  };
}
