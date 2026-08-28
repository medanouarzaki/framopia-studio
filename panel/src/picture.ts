import type { CandidateView, ImageSlotView } from './types.js';

/**
 * Which picture to show for a candidate, and what to say when there is none.
 *
 * **The panel and the service are deployed separately.** The panel is reloaded
 * from `panel/dist` while the service is a long-running process the user
 * started earlier, so a bundle can be newer than the service it is talking to.
 * Session 31 added `renderedPath` to the service's reply and read it in the
 * panel without allowing for that: against a service started before the change
 * the field was `undefined`, and every candidate reported **"this picture is
 * missing from the disk"** — a claim of data loss for ten files that were all
 * present.
 *
 * So this falls back to the older shape rather than concluding anything, and
 * separates the three states that were being collapsed into one sentence.
 */
export type PictureState =
  /** The service named a file and says it is there. */
  | { state: 'ready'; path: string }
  /** The service named a file and says it is not on the disk. */
  | { state: 'absent'; path: string }
  /** The service did not say which picture this is — it is older than the panel. */
  | { state: 'unnamed' };

/** True when the build shows this slot's subject cut out of its background. */
function cutoutSlot(slot: ImageSlotView): boolean {
  return slot.rendersAsCutout ?? slot.presentation === 'cutout';
}

/**
 * The picture the build will place.
 *
 * `renderedPath` is the service's own answer and is preferred. Without it the
 * same rule is applied to the fields an older service does send, which is
 * exactly what the builder does: the cut-out on a cutout slot, the generated
 * picture otherwise.
 */
export function pictureFor(slot: ImageSlotView, candidate: CandidateView): PictureState {
  const rendered = candidate.renderedPath;
  if (typeof rendered === 'string' && rendered !== '') {
    // `renderedExists` travels with `renderedPath`; a service sending one sends
    // both, so an absent flag here means the file really is gone.
    return candidate.renderedExists === false
      ? { state: 'absent', path: rendered }
      : { state: 'ready', path: rendered };
  }

  const useCutout = cutoutSlot(slot) && typeof candidate.cutoutPath === 'string';
  const path = useCutout ? (candidate.cutoutPath as string) : candidate.imagePath;
  if (typeof path !== 'string' || path === '') return { state: 'unnamed' };
  const exists = useCutout ? candidate.cutoutExists : candidate.imageExists;
  return exists === false ? { state: 'absent', path } : { state: 'ready', path };
}

/**
 * A `file://` URL for an absolute path.
 *
 * The paths here contain spaces — `my files/test videos/cutouts/…` — and a raw
 * space is not legal in a URL. Encoding is done once, here, so a picture that
 * lives under a directory with a space in its name loads.
 */
export function fileUrl(absolutePath: string): string {
  return encodeURI(`file://${absolutePath}`).replace(/#/g, '%23').replace(/\?/g, '%3F');
}
