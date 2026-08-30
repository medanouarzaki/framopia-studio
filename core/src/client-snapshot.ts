import type { ClientMode, ModeFonts, PaletteRole } from './mode.js';
import { DEFAULT_TEXT_COLOUR_ROLES } from './text-colours.js';

/**
 * The client's look, copied onto a reel rather than pointed at.
 *
 * **The decision, and the failure it avoids.** A plan used to carry
 * `clientMode: { id, version, path }` — a pointer — and the build read the mode
 * file as it stood at build time. So a reel approved in March, rebuilt in June
 * after the client's palette or faces were re-tuned, came out different with
 * nothing on screen to say why. Of the two possible failures that is the worse
 * one: a rebuild that silently disagrees with what was approved cannot be
 * noticed, while a rebuild that is deliberately out of date can be, and can be
 * moved forward with one control. Block 10's golden run needs a fixed input for
 * the same reason.
 *
 * So the identity is **copied**, and moving a reel to the client's current look
 * is an explicit action a person takes.
 *
 * **What is here is what a build reads**: the palette (the card frame colour is
 * derived from it), the faces, which palette role carries which kind of word,
 * and how large a picture is drawn. A client's own **pictures** are deliberately
 * absent — those are files on disk chosen by hand, and pinning a path would
 * break the moment one is moved or replaced.
 */
export const CLIENT_SNAPSHOT_VERSION = 1;

export interface ClientSnapshot {
  snapshotVersion: number;
  id: string;
  name: string;
  /** The client's own version, as it stood when this was taken. */
  version: number;
  palette: Record<PaletteRole, string>;
  fonts: ModeFonts;
  /** Resolved, so a snapshot never has to be read against today's defaults. */
  textColours: { ordinary: PaletteRole; emphasis: PaletteRole; shadow?: PaletteRole };
  imageScale: number;
  capturedAt: string;
}

export function snapshotOfMode(mode: ClientMode, capturedAt: string): ClientSnapshot {
  return {
    snapshotVersion: CLIENT_SNAPSHOT_VERSION,
    id: mode.id,
    name: mode.name,
    version: mode.version,
    palette: { ...mode.palette },
    fonts: { ...mode.fonts },
    textColours: {
      ordinary: mode.textColours?.ordinary ?? DEFAULT_TEXT_COLOUR_ROLES.ordinary,
      emphasis: mode.textColours?.emphasis ?? DEFAULT_TEXT_COLOUR_ROLES.emphasis,
      // Optional with no default: absent means the template's own colour, and
      // a snapshot must not invent one for a client who named none.
      ...(mode.textColours?.shadow === undefined ? {} : { shadow: mode.textColours.shadow }),
    },
    imageScale: mode.imageScale ?? 1,
    capturedAt,
  };
}

/**
 * Whether two snapshots would build the same reel.
 *
 * `capturedAt` is excluded deliberately: it records when a copy was taken, and
 * two copies of the same client taken a minute apart must compare equal or the
 * migration could never be checked against a fresh pin.
 */
export function snapshotsAgree(a: ClientSnapshot, b: ClientSnapshot): boolean {
  const strip = (s: ClientSnapshot): string =>
    JSON.stringify({ ...s, capturedAt: null });
  return strip(a) === strip(b);
}

/** Whether the client has moved on since this reel was pinned. */
export function snapshotIsBehind(snapshot: ClientSnapshot, mode: ClientMode): boolean {
  return !snapshotsAgree(snapshot, snapshotOfMode(mode, snapshot.capturedAt));
}
