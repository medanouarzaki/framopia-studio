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

/**
 * The videos already set up as this client's that the folder just declared for
 * them does not contain.
 *
 * **A folder declared too deep is silently narrow.** Dr Loubna Kfafi keeps
 * footage in at least two unrelated places inside her own folder —
 * `Framopia Studio Inputs/Footages/` and `September Content/Exports/Work in
 * Progress/` — so declaring either one leaves the other owned by nobody, and
 * `whoseVideo` then answers `null` for a video that plainly is hers. Sessions 77
 * and 79 both measured this and neither said anything to him about it.
 *
 * **What this rests on, and what it refuses to guess.** The only evidence used
 * is what the tool wrote down itself: a reel's plan records which client it was
 * set up as, and where its video is. Nothing is inferred from the shape or the
 * wording of a path — session 76 refused a rule that read a client's name out of
 * a directory name, on the grounds that it could not hold for a machine that had
 * never seen this project, and that reasoning applies here unchanged. Walking up
 * from the declared folder looking for stray videos would be the same mistake in
 * a different costume: it would sweep in whatever else happened to be nearby.
 *
 * On a machine with no reels yet there is no evidence either way, and this says
 * nothing. That is the correct answer, not a gap.
 */
export function videosLeftOutside(options: {
  clientId: string;
  videoFolder: string | undefined;
  /** One per reel already made: which client it was set up as, and its video. */
  setUpAs: readonly { clientId: string; videoPath: string }[];
  /**
   * Every client and their declared folder, so a video this rule is about to
   * count can first be asked whose it looks like.
   *
   * Optional, and an absent list only makes this say more rather than less, so
   * an older caller keeps working.
   */
  clients?: readonly ClientFolder[];
}): string[] {
  const { clientId, videoFolder, setUpAs, clients = [] } = options;
  if (typeof videoFolder !== 'string' || videoFolder.trim() === '') return [];
  const folder = path.resolve(videoFolder);
  const outside = setUpAs
    .filter((reel) => reel.clientId === clientId)
    .map((reel) => reel.videoPath)
    .filter((videoPath) => !inside(folder, path.resolve(videoPath)))
    /*
     * **A video that looks like someone else's is not evidence about this
     * client's folder.**
     *
     * Session 81 found K2 Syndicalia being told three videos sat outside its
     * folder, one of them `sora-995f2d27` — the very reel `mismatchedClient`
     * says is Dr Loubna Kfafi's footage attached to K2. Both rules were reading
     * the same fact and drawing opposite conclusions from it: one said the reel
     * is on the wrong client, the other said K2's folder is too narrow to hold
     * it. Only the first is true, and widening K2's folder to take in Dr
     * Loubna's would be the worst thing he could do about it.
     *
     * So the two rules are ordered rather than balanced: **the wrong-client rule
     * answers first**, and whatever it claims is left out of this one.
     */
    .filter((videoPath) => {
      const owner = whoseVideo(videoPath, clients);
      return owner === null || owner.id === clientId;
    })
    /*
     * **The sentence promises that a folder further up would take them in, so
     * there has to be one.**
     *
     * The other two K2 was warned about are reels whose videos live in the
     * operating system's temporary directory. Nothing they share with a client
     * folder on an external disk is a folder anyone would declare — the first
     * thing the two paths have in common is the root of the filesystem. Saying
     * "a folder further up would take them in" about those is not a warning, it
     * is false advice.
     *
     * A video counts only when it and the declared folder are both inside some
     * real folder below the disk they are on. That is a fact about paths, not
     * about his disk, and it holds for a machine that has never seen this
     * project.
     */
    .filter((videoPath) => sharesAFolderWith(folder, path.resolve(videoPath)));
  return [...new Set(outside)];
}

/**
 * Whether two paths meet anywhere that is a folder rather than a disk.
 *
 * `/` is where everything meets, and on macOS every external volume meets at
 * `/Volumes`, so neither of those counts as somewhere a person keeps a client's
 * work. Anything deeper does.
 */
function sharesAFolderWith(a: string, b: string): boolean {
  const left = a.split(path.sep).filter((part) => part !== '');
  const right = b.split(path.sep).filter((part) => part !== '');
  let shared = 0;
  while (shared < left.length && shared < right.length && left[shared] === right[shared]) {
    shared += 1;
  }
  if (shared === 0) return false;
  // `/Volumes/<disk>` is a mount point; two paths meeting only there are on the
  // same Mac, not in the same folder.
  if (left[0] === 'Volumes') return shared > 2;
  return shared > 1;
}

/**
 * What he is told, in the place he sets the folder.
 *
 * No path: he chose the folder a moment ago and is looking at it, and the count
 * is the fact that matters. **It says what was noticed and stops** — the folder
 * is not changed, nothing is moved, and he decides.
 */
export function leftOutsideSentence(count: number): string | null {
  if (count <= 0) return null;
  const videos = count === 1 ? 'One video' : `${count} videos`;
  const them = count === 1 ? 'it' : 'them';
  return (
    `${videos} already set up as this client's ${count === 1 ? 'sits' : 'sit'} outside this ` +
    `folder, so the tool will not recognise ${them} as theirs. A folder further up would take ` +
    `${them} in. Nothing has been changed.`
  );
}
