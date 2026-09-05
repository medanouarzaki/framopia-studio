import { existsSync } from 'node:fs';
import path from 'node:path';
import { labelWords, type ClientPicture } from '@framopia/core';
import { readEditPlan, writeEditPlan } from './editplan/io.js';
import { keepPicture } from './clients/picture-store.js';
import { videoDirName, videoOf } from './video-identity.js';

export class VideoPictureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VideoPictureError';
  }
}

/**
 * Pictures attached to one reel, added and forgotten one at a time.
 *
 * **Why a reel has its own and not only the client's.** A client's pictures are
 * the things they always have — a product, a logo, the clinic. A reel often
 * needs one shot that belongs to it alone: the thing this particular video is
 * about. Putting it on the client would offer it to every video they ever make.
 *
 * Everything else is the client's rule exactly, on purpose: the same label, the
 * same matcher, the same never-sent and never-copied guarantees. **Nothing is
 * copied** — the path is written onto the plan and the file stays where the
 * user put it.
 *
 * Ids are `own001` upward. A client's are `pic001` upward, and a slot records
 * one id for either, so the two namespaces must not meet.
 */
export function nextOwnPictureId(pictures: readonly ClientPicture[]): string {
  let n = pictures.length + 1;
  const taken = new Set(pictures.map((p) => p.id));
  while (taken.has(`own${String(n).padStart(3, '0')}`)) n += 1;
  return `own${String(n).padStart(3, '0')}`;
}

function check(picture: { path: string; description: string }): void {
  if (!path.isAbsolute(picture.path)) {
    throw new VideoPictureError('a picture needs the full path to the file');
  }
  if (!existsSync(picture.path)) {
    throw new VideoPictureError(`there is no file at ${picture.path}`);
  }
  if (picture.description.trim() === '') {
    throw new VideoPictureError('describe the picture, so you can tell it from the others later');
  }
}

/** Written only when it says something; absent is what means "chosen by hand". */
function labelField(label: string | undefined): { label?: string } {
  if (label === undefined) return {};
  const trimmed = label.trim();
  if (trimmed === '' || labelWords(trimmed).length === 0) return {};
  return { label: trimmed };
}

export async function addVideoPicture(
  planPath: string,
  picture: { path: string; description: string; label?: string },
): Promise<ClientPicture> {
  check(picture);
  const plan = await readEditPlan(planPath);
  const pictures = plan.pictures ?? [];
  const id = nextOwnPictureId(pictures);
  const entry: ClientPicture = {
    id,
    /*
     * Under the video's own directory name, which carries its sha256 — two of
     * the client's files are both called `sora.mov`, and a picture filed under
     * the name alone would put one reel's shot on the other's.
     */
    path: keepPicture({ owner: videoDirName(videoOf(plan.source)), pictureId: id, from: picture.path }),
    description: picture.description.trim(),
    ...labelField(picture.label),
  };
  plan.pictures = [...pictures, entry];
  await writeEditPlan(planPath, plan);
  return entry;
}

/**
 * The label on a picture already attached, changed or cleared.
 *
 * Its own operation for the same reason the client's is: a label is corrected
 * far more often than a picture is replaced, and re-adding the file to change
 * one word would renumber it and orphan every slot that names it.
 */
export async function setVideoPictureLabel(
  planPath: string,
  pictureId: string,
  label: string,
): Promise<ClientPicture> {
  const plan = await readEditPlan(planPath);
  const pictures = plan.pictures ?? [];
  const found = pictures.find((p) => p.id === pictureId);
  if (found === undefined) {
    throw new VideoPictureError(`this video has no picture called ${pictureId}`);
  }
  const next: ClientPicture = { id: found.id, path: found.path, description: found.description };
  const written = labelField(label);
  if (written.label !== undefined) next.label = written.label;
  plan.pictures = pictures.map((p) => (p.id === pictureId ? next : p));
  await writeEditPlan(planPath, plan);
  return next;
}

/**
 * Forget a picture attached to this reel.
 *
 * **A slot that had already chosen it is put back to being generated**, because
 * a slot naming a picture nothing can resolve is a build that refuses at
 * pre-flight — and the user forgetting a picture is not asking for that. The
 * word that chose it goes with it.
 */
export async function removeVideoPicture(
  planPath: string,
  pictureId: string,
): Promise<{ freedSlots: string[] }> {
  const plan = await readEditPlan(planPath);
  const pictures = (plan.pictures ?? []).filter((p) => p.id !== pictureId);
  if (pictures.length === 0) delete plan.pictures;
  else plan.pictures = pictures;

  const freedSlots: string[] = [];
  plan.images = {
    slots: plan.images.slots.map((slot) => {
      if (slot.chosenClientPictureId !== pictureId) return slot;
      freedSlots.push(slot.id);
      const next = { ...slot };
      delete next.chosenClientPictureId;
      delete next.chosenClientPictureWord;
      return next;
    }),
  };
  await writeEditPlan(planPath, plan);
  return { freedSlots };
}
