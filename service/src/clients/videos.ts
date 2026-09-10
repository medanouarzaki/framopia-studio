import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { loadMode } from '@framopia/core';

/**
 * How far in the search will go before it stops and says so.
 *
 * **The real guard is the clock**, because a person is waiting on this: the panel
 * asks for the list and draws nothing until it answers. Two seconds is about how
 * long that is worth, which is a fact about him waiting and not about his disk.
 *
 * The directory budget is the belt to that pair of braces. On a fast local disk
 * two seconds is long enough to enumerate an enormous tree, so the count bounds
 * the work even when the clock does not. **Neither number is fitted to his
 * folder** — I could not justify a depth limit without measuring his tree, which
 * is exactly the reasoning session 76 refused, so there is no depth limit at all.
 * A tree of any shape is allowed; only the total work is bounded.
 *
 * Symlinks are never followed, so no arrangement of folders can make this loop.
 */
const SEARCH_MILLISECONDS = 2000;
const SEARCH_DIRECTORIES = 2000;

/**
 * Directories that are one opaque thing rather than a place to keep footage.
 *
 * A macOS package looks like a directory and holds thousands of files; an editing
 * library holds its own copies of media that are not deliverables. Walking into
 * one spends the whole budget and offers him files he never put there. Matched by
 * extension, which is what makes a package a package — not by name, and not by
 * anything read off this machine.
 */
const NOT_A_PLACE_FOR_FOOTAGE = [
  '.app', '.bundle', '.framework', '.pkg', '.photoslibrary', '.imovielibrary',
  '.tvlibrary', '.aplibrary', '.fcpbundle', '.pproj', '.prproj', '.lrdata',
];

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
  /**
   * The folder it was found in, relative to the one declared, or `''` at the top.
   *
   * **Three of Dr Loubna Kfafi's files are called `sora.mov`.** The label is the
   * filename without its extension, so on its own it names three different
   * videos identically — and a filename collision has cost this project three
   * sessions and $1.01 already, which is why everything per-video is keyed on the
   * video's sha256 through `video-identity.ts` rather than on its name. This is
   * the screen's half of that: what he reads tells them apart too.
   */
  where: string;
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
  try {
    if (!statSync(folder).isDirectory()) {
      return { ...empty, trouble: `${folder} is a file, not a folder.` };
    }
  } catch (error) {
    return { ...empty, trouble: `${folder} could not be read: ${(error as Error).message}` };
  }

  const videos: FolderVideo[] = [];
  const skipped: { name: string; why: string }[] = [];

  /*
   * **Breadth first, so the shallowest videos are found even if the budget runs
   * out.** Session 79 told Mohamed to declare the client root so the
   * wrong-client rule could resolve both of Dr Loubna Kfafi's videos; the list
   * then looked only in that folder and reported "There are no videos in …",
   * because all 25 of hers are two, three and four levels down. One declaration
   * has to serve both, so this looks the whole way in.
   *
   * An explicit queue rather than recursion: the depth is a person's folders,
   * not this function's stack, and there is no depth limit to blow it anyway.
   */
  const queue: string[] = [folder];
  const startedAt = Date.now();
  let directoriesRead = 0;
  let stoppedEarly = false;

  while (queue.length > 0) {
    if (directoriesRead >= SEARCH_DIRECTORIES || Date.now() - startedAt > SEARCH_MILLISECONDS) {
      stoppedEarly = true;
      break;
    }
    const here = queue.shift() as string;
    let entries;
    try {
      entries = readdirSync(here, { withFileTypes: true });
    } catch {
      /*
       * **One unreadable folder is not the end of the list.** A permission he
       * never granted, or a folder that went away between being queued and being
       * read, must not cost him the videos everywhere else. It is named rather
       * than passed over in silence.
       */
      skipped.push({
        name: path.relative(folder, here) || path.basename(here),
        why: 'this folder could not be read',
      });
      continue;
    }
    directoriesRead += 1;

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(here, entry.name);

      if (entry.isDirectory()) {
        if (NOT_A_PLACE_FOR_FOOTAGE.includes(path.extname(entry.name).toLowerCase())) continue;
        queue.push(full);
        continue;
      }
      // Never followed: a link is the one way a tree of folders can be a circle.
      if (entry.isSymbolicLink()) continue;
      if (!entry.isFile()) continue;

      const extension = path.extname(entry.name).toLowerCase();
      if (!VIDEO_EXTENSIONS.includes(extension)) {
        /*
         * **Only what he might have expected to be offered.**
         *
         * `.aep` and `.prproj` were on this list, and Dr Loubna Kfafi keeps her
         * After Effects projects and their auto-saves beside her footage —
         * eleven of them. Session 84: he picked a video, the run failed, and the
         * real reason was under a wall of eleven lines saying his own project
         * files could not be opened. They were never going to be: an editing
         * project is not a video anyone would expect this tool to offer, and
         * saying so about each one buries the thing that actually broke.
         *
         * The formats below stay, because each really is video this tool will
         * not open, and a video he can see in the folder and not in the list is
         * a video he goes looking for. **Nothing that could not be read for a
         * real reason is hidden** — an unreadable file and an empty one are
         * reported by the two branches after this, and a folder that could not
         * be opened by the walk itself.
         */
        if (/\.(webm|flv|wmv|mpg|mpeg|mts|m2ts)$/i.test(entry.name)) {
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
      videos.push({
        label: entry.name.replace(/\.[^.]+$/, ''),
        path: full,
        sizeBytes,
        where: path.relative(folder, here),
      });
    }
  }

  /* Where first, then name: the same three names read as three different videos. */
  videos.sort((a, b) =>
    a.where === b.where ? (a.label < b.label ? -1 : 1) : a.where < b.where ? -1 : 1,
  );

  return {
    folder,
    videos,
    skipped,
    trouble:
      videos.length > 0
        ? stoppedEarly
          ? 'There may be more videos further inside this folder than are listed here.'
          : null
        : stoppedEarly
          ? `Nothing turned up in ${folder} before the search had to stop. ` +
            'If the videos are a long way inside, choosing a folder closer to them finds them.'
          : skipped.length === 0
            ? `There are no videos in ${folder}, or in any folder inside it.`
            : null,
  };
}
