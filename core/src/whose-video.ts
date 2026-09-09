import path from 'node:path';

/**
 * **Whose video is this, and does the plan agree?**
 *
 * Block 12 session 75 found `sora-995f2d27` — Dr Loubna Kfafi's footage — built
 * wearing K2 Syndicalia's four colours. The plan was made on 2026-08-31, four
 * days before her client existed, so it pinned `k2-syndicalia` and never let go.
 * Mohamed confirmed that reel was a test and was never sent. Nothing warned him.
 *
 * **The evidence is the folder a client declares, and nothing else.**
 *
 * His footage happens to sit under `…/Clients/<name>/…`, and reading a client's
 * name out of a path would have caught this exact case. It is still the wrong
 * rule: it works on his disk and on no other, and the partner's Mac will not
 * look like his. A client already has a `videoFolder` — **a folder the person
 * chose and typed** — and a video inside it belongs to them on any machine, in
 * any arrangement, in any language.
 *
 * **Silence is the default and it is deliberate.** This answers `null` far more
 * often than it answers a name: when no client has declared a folder, when the
 * video is in none of them, when it is in more than one. A warning that fires on
 * a guess teaches him to ignore warnings, and then the true one goes unread too.
 *
 * **What it cannot tell.**
 * - Nothing at all until at least one client declares a folder. On the disk this
 *   was written on, neither real client has, so it is silent about every plan
 *   including `sora-995f2d27` — measured, not assumed.
 * - Nothing about a video outside every declared folder: it may belong to a
 *   client who has not declared one, and that is not knowable from here.
 * - Nothing when two clients' folders contain the same video. Ambiguous is not a
 *   finding.
 * - It never says a video does **not** belong to the attached client. It says
 *   only that the video sits in a **different** client's own folder, which is
 *   evidence rather than inference.
 */
export interface ClientFolder {
  id: string;
  name: string;
  /** The folder that client's videos live in, as the person chose it. */
  videoFolder?: string | undefined;
}

/** Whether `child` is `parent` or sits inside it, by segments rather than prefix. */
function inside(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * The one client whose declared folder holds this video, or null.
 *
 * Null when none does, and null when more than one does — two clients pointed at
 * the same folder, or one folder nested in another, is a question about their
 * setup and not an answer about this video.
 */
export function whoseVideo(
  videoPath: string,
  clients: readonly ClientFolder[],
): ClientFolder | null {
  if (typeof videoPath !== 'string' || videoPath.trim() === '') return null;
  const holders = clients.filter(
    (c) =>
      typeof c.videoFolder === 'string' &&
      c.videoFolder.trim() !== '' &&
      inside(path.resolve(c.videoFolder), path.resolve(videoPath)),
  );
  return holders.length === 1 ? (holders[0] as ClientFolder) : null;
}

export interface Mismatch {
  /** The client the plan is attached to and would build in. */
  attachedTo: { id: string; name: string };
  /** The client whose own folder the video sits in. */
  looksLike: { id: string; name: string };
}

/**
 * **Said only when the evidence is clear.** The video is inside exactly one
 * client's declared folder, the plan is attached to a client, and they are not
 * the same one. Anything less is null and nothing is shown.
 */
export function mismatchedClient(options: {
  videoPath: string;
  attachedTo: { id: string; name: string } | null | undefined;
  clients: readonly ClientFolder[];
}): Mismatch | null {
  const { videoPath, attachedTo, clients } = options;
  if (attachedTo === null || attachedTo === undefined) return null;
  if (typeof attachedTo.id !== 'string' || attachedTo.id === '') return null;
  const owner = whoseVideo(videoPath, clients);
  if (owner === null || owner.id === attachedTo.id) return null;
  return {
    attachedTo: { id: attachedTo.id, name: attachedTo.name },
    looksLike: { id: owner.id, name: owner.name },
  };
}

/**
 * What he is told, in his own words.
 *
 * No path, no version, no id. The two names and what pressing the offer would
 * change — because re-attaching changes the colours, the faces and the shadow
 * the reel is built in, and that is not a small thing to do by accident.
 */
export function mismatchSentence(m: Mismatch): string {
  return (
    `This video is in ${m.looksLike.name}'s folder, but it is set up as ` +
    `${m.attachedTo.name}. It will be built in ${m.attachedTo.name}'s colours and ` +
    `type unless you change it.`
  );
}

export function reattachSentence(m: Mismatch): string {
  return (
    `Use ${m.looksLike.name} instead — their colours, their type, and the shadow ` +
    `behind the words. Nothing already built changes, and the old setting is kept.`
  );
}
