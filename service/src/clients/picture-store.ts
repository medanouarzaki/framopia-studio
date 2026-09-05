import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { REPO_ROOT, clientPictureStorePath } from '@framopia/core';

/**
 * Keeps a copy of a client's photograph inside the project.
 *
 * **Mohamed's ruling of 2026-09-05.** A photograph used to be referenced where
 * its owner left it, which made a client file portable to one machine only.
 * Session 61 gave those paths read-time re-rooting, and that carries a picture
 * already inside the project and can do nothing for one on a Desktop. So the
 * bytes come in, git carries them, and a clone has them.
 *
 * **Copy, never move.** The original is the owner's and stays exactly where it
 * is — this only ever reads it.
 *
 * **It never overwrites.** A picture id is unique within its owner, so a
 * collision needs an id to be reused after a removal; if that happens and the
 * bytes differ, the copy takes a name carrying the source's own hash instead.
 * An identical file already there is left alone and reused, so attaching the
 * same photograph twice writes nothing and is not an error.
 */
export function keepPicture(options: {
  /** A client's id, or a video's directory name. */
  owner: string;
  /** `pic001` on a client, `own001` on a video. */
  pictureId: string;
  /** The file the user chose. Read, never written, never moved. */
  from: string;
  repoRoot?: string;
}): string {
  const { owner, pictureId, from } = options;
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  const extension = path.extname(from).toLowerCase();
  const wanted = clientPictureStorePath({ repoRoot, owner, pictureId, extension });

  const source = readFileSync(from);
  const destination = existsSync(wanted) && !sameBytes(wanted, source)
    ? clientPictureStorePath({
        repoRoot,
        owner,
        pictureId: `${pictureId}-${createHash('sha256').update(source).digest('hex').slice(0, 12)}`,
        extension,
      })
    : wanted;

  if (existsSync(destination) && sameBytes(destination, source)) return destination;
  mkdirSync(path.dirname(destination), { recursive: true });
  copyFileSync(from, destination);
  return destination;
}

function sameBytes(file: string, bytes: Buffer): boolean {
  try {
    return readFileSync(file).equals(bytes);
  } catch {
    return false;
  }
}
