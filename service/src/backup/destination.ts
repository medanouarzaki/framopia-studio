import { realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

/**
 * Whether a destination is a cloud folder, a local disk, or neither one this
 * tool can tell apart.
 *
 * **It is a path heuristic and nothing stronger, which is why `unknown` exists.**
 * The obvious measurement does not work: `df` reports
 * `~/Library/CloudStorage/GoogleDrive-…` as `/dev/disk3s1`, the machine's own
 * data volume, exactly as it reports a real folder — because a macOS
 * FileProvider is not a mount. So there is no filesystem fact available before
 * writing that separates the two, and the only honest options are to recognise
 * the known roots, recognise a real external volume, and **refuse to guess
 * about anything else**.
 *
 * Guessing wrong in one direction copies an API key into a shared cloud folder.
 * A heuristic presented as a guarantee would be worse than none.
 */
export type DestinationKind = 'cloud' | 'local' | 'unknown';

/**
 * The macOS FileProvider root every modern sync client uses, plus iCloud's own
 * and the legacy home-directory folders the older clients created.
 */
const CLOUD_ROOTS = [
  path.join(homedir(), 'Library', 'CloudStorage'),
  path.join(homedir(), 'Library', 'Mobile Documents'),
  path.join(homedir(), 'Dropbox'),
  path.join(homedir(), 'Google Drive'),
  path.join(homedir(), 'OneDrive'),
];

const under = (child: string, parent: string): boolean =>
  child === parent || child.startsWith(`${parent}${path.sep}`);

/** Resolves symlinks as far as the path exists, so a link cannot hide a root. */
function resolveAsFarAsPossible(target: string): string {
  let current = path.resolve(target);
  for (;;) {
    try {
      return path.join(realpathSync(current), path.relative(current, path.resolve(target)));
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return path.resolve(target);
      current = parent;
    }
  }
}

export function classifyDestination(target: string): DestinationKind {
  const real = resolveAsFarAsPossible(target);
  if (CLOUD_ROOTS.some((root) => under(real, root))) return 'cloud';
  // A real external volume. `/Volumes` also holds network shares, which is why
  // this says local rather than "safe".
  if (under(real, '/Volumes')) return 'local';
  return 'unknown';
}

/**
 * Whether a file's bytes are on this machine, or only in the cloud.
 *
 * **Measured on this Drive mount rather than assumed.** An existing Drive file
 * that has never been downloaded reports `st_blocks` 0 against a 6,298,543-byte
 * size and carries macOS's `dataless` flag; a file written into the same folder
 * reports 3912 blocks for 2,000,000 bytes and no flag. So the block count
 * discriminates here, and Node exposes it without shelling out.
 *
 * **What it cannot tell you** is whether the bytes will *stay*. Drive evicts
 * local copies to reclaim space, so this verifies the file is here now, not
 * that it will be here in a year.
 */
export function isMaterialised(file: string): boolean {
  const stats = statSync(file);
  return stats.size === 0 || stats.blocks > 0;
}
