import { describe, expect, it } from 'vitest';
import path from 'node:path';
import {
  mismatchSentence,
  mismatchedClient,
  reattachSentence,
  whoseVideo,
  type ClientFolder,
  videosLeftOutside,
  leftOutsideSentence,
} from './whose-video.js';

/**
 * **Whose video is this, and does the plan agree?**
 *
 * Session 75 found `sora-995f2d27` — Dr Loubna Kfafi's footage — built in K2
 * Syndicalia's colours, because its plan was made four days before her client
 * existed. Mohamed confirmed that reel was a test and was never sent, and ruled
 * that the tool notices and offers, and never re-attaches by itself.
 */
const LOUBNA: ClientFolder = {
  id: 'dr-loubna-kfafi',
  name: 'Dr Loubna Kfafi',
  videoFolder: path.join(path.sep, 'Volumes', 'Drive', 'Clients', 'Loubna'),
};
const K2: ClientFolder = {
  id: 'k2-syndicalia',
  name: 'K2 Syndicalia',
  videoFolder: path.join(path.sep, 'Volumes', 'Drive', 'Clients', 'K2'),
};
const HERS = path.join(LOUBNA.videoFolder as string, 'September', 'sora.mov');

describe('whose video it is', () => {
  it('is the client whose own folder holds it', () => {
    expect(whoseVideo(HERS, [LOUBNA, K2])?.id).toBe('dr-loubna-kfafi');
  });

  /*
   * **Silence is the default.** A warning that fires on a guess teaches him to
   * ignore warnings, and then the true one goes unread too.
   */
  it('says nothing when no client has declared a folder', () => {
    const undeclared = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ];
    expect(whoseVideo(HERS, undeclared)).toBeNull();
  });

  it('says nothing about a video outside every declared folder', () => {
    expect(whoseVideo(path.join(path.sep, 'elsewhere', 'x.mov'), [LOUBNA, K2])).toBeNull();
  });

  /* Ambiguous is not a finding: nested or duplicated folders answer nothing. */
  it('says nothing when two clients could both claim it', () => {
    const nested: ClientFolder = {
      id: 'other',
      name: 'Other',
      videoFolder: path.join(path.sep, 'Volumes', 'Drive', 'Clients'),
    };
    expect(whoseVideo(HERS, [LOUBNA, nested])).toBeNull();
  });

  /*
   * The rule rests on a folder the person chose, not on what a folder is
   * called. Mohamed's footage happens to sit under `…/Clients/<name>/…`, and
   * reading a name out of a path would have caught his case and no one else's.
   */
  it('reads no meaning from what a folder is called', () => {
    const oddly: ClientFolder = {
      id: 'dr-loubna-kfafi',
      name: 'Dr Loubna Kfafi',
      videoFolder: path.join(path.sep, 'srv', 'z9', '2026-q3'),
    };
    const video = path.join(path.sep, 'srv', 'z9', '2026-q3', 'a.mov');
    expect(whoseVideo(video, [oddly])?.id).toBe('dr-loubna-kfafi');
    // And a folder named after a client it is not does not make it theirs.
    const named: ClientFolder = {
      id: 'someone-else',
      name: 'Someone Else',
      videoFolder: path.join(path.sep, 'Clients', 'Dr Loubna Kfafi'),
    };
    expect(
      whoseVideo(path.join(path.sep, 'Clients', 'Dr Loubna Kfafi', 'b.mov'), [named])?.id,
    ).toBe('someone-else');
  });
});

describe('a video and a client that do not match', () => {
  const attachedToK2 = { id: 'k2-syndicalia', name: 'K2 Syndicalia' };

  it('is noticed when the plan says one client and the folder says another', () => {
    const m = mismatchedClient({ videoPath: HERS, attachedTo: attachedToK2, clients: [LOUBNA, K2] });
    expect(m?.attachedTo.name).toBe('K2 Syndicalia');
    expect(m?.looksLike.name).toBe('Dr Loubna Kfafi');
  });

  it('is silent when they agree', () => {
    const hers = { id: 'dr-loubna-kfafi', name: 'Dr Loubna Kfafi' };
    expect(mismatchedClient({ videoPath: HERS, attachedTo: hers, clients: [LOUBNA, K2] })).toBeNull();
  });

  it('is silent when the evidence cannot say', () => {
    expect(
      mismatchedClient({
        videoPath: HERS,
        attachedTo: attachedToK2,
        clients: [{ id: 'k2-syndicalia', name: 'K2 Syndicalia' }],
      }),
    ).toBeNull();
  });

  it('is silent when no client is attached at all', () => {
    expect(mismatchedClient({ videoPath: HERS, attachedTo: null, clients: [LOUBNA, K2] })).toBeNull();
  });

  /* Two names and what changes. No path, no version, no id. */
  it('says it in his words, naming neither a path nor a version', () => {
    const m = mismatchedClient({ videoPath: HERS, attachedTo: attachedToK2, clients: [LOUBNA, K2] });
    const said = mismatchSentence(m as NonNullable<typeof m>);
    const offer = reattachSentence(m as NonNullable<typeof m>);
    expect(said).toContain('Dr Loubna Kfafi');
    expect(said).toContain('K2 Syndicalia');
    /*
     * Whole words. The first version of this looked for the substring "id" and
     * found it inside "video", which is the test being wrong rather than the
     * sentence.
     */
    for (const jargon of ['version', 'mode', 'plan', 'snapshot', 'id', 'palette']) {
      const found = new RegExp(`\\b${jargon}\\b`, 'i').test(said);
      expect(`${jargon}: ${found}`).toBe(`${jargon}: false`);
    }
    // And no path: nothing in it looks like a folder.
    expect(said).not.toContain('/');
    // The offer says what pressing it changes, because it changes the look.
    expect(offer).toContain('colours');
    expect(offer).toContain('Nothing already built changes');
  });
});

/**
 * **A folder declared too deep leaves a client's own footage unowned.**
 *
 * Sessions 77 and 79 both measured this and neither said anything to him:
 * declaring `…/Dr Loubna Kfafi/Framopia Studio Inputs/Footages` rather than her
 * folder itself leaves everything in `September Content/…` answering `null` from
 * `whoseVideo`, for a video that is plainly hers.
 *
 * The only evidence used is what the tool wrote down itself — a reel's plan says
 * which client it was set up as and where its video is. Nothing is read out of
 * the shape of a path.
 */
describe('videos a declared folder leaves out', () => {
  const HERS = '/Clients/Loubna';
  const setUpAs = [
    { clientId: 'loubna', videoPath: `${HERS}/Inputs/Footages/one.mov` },
    { clientId: 'loubna', videoPath: `${HERS}/September/Exports/two.mov` },
    { clientId: 'k2', videoPath: `${HERS}/September/Exports/three.mov` },
  ];

  it('finds none when the folder is the client’s own root', () => {
    expect(
      videosLeftOutside({ clientId: 'loubna', videoFolder: HERS, setUpAs }),
    ).toEqual([]);
  });

  it('finds the sibling footage when the folder is declared too deep', () => {
    expect(
      videosLeftOutside({
        clientId: 'loubna',
        videoFolder: `${HERS}/Inputs/Footages`,
        setUpAs,
      }),
    ).toEqual([`${HERS}/September/Exports/two.mov`]);
  });

  /* Another client's video in her tree is not evidence about her folder. */
  it('counts only videos set up as this client', () => {
    expect(
      videosLeftOutside({
        clientId: 'loubna',
        videoFolder: `${HERS}/September`,
        setUpAs,
      }),
    ).toEqual([`${HERS}/Inputs/Footages/one.mov`]);
  });

  it('says nothing when no folder has been declared', () => {
    expect(videosLeftOutside({ clientId: 'loubna', videoFolder: undefined, setUpAs })).toEqual([]);
    expect(videosLeftOutside({ clientId: 'loubna', videoFolder: '   ', setUpAs })).toEqual([]);
  });

  /* A machine with no reels has no evidence either way, and says so by silence. */
  it('says nothing on a machine that has made no reels', () => {
    expect(videosLeftOutside({ clientId: 'loubna', videoFolder: HERS, setUpAs: [] })).toEqual([]);
  });

  it('names the same video once however many reels used it', () => {
    expect(
      videosLeftOutside({
        clientId: 'loubna',
        videoFolder: `${HERS}/Inputs`,
        setUpAs: [
          { clientId: 'loubna', videoPath: `${HERS}/September/two.mov` },
          { clientId: 'loubna', videoPath: `${HERS}/September/two.mov` },
        ],
      }),
    ).toEqual([`${HERS}/September/two.mov`]);
  });
});

describe('what he is told about a folder that leaves videos out', () => {
  it('says nothing at all when nothing is left out', () => {
    expect(leftOutsideSentence(0)).toBeNull();
  });

  it('says it once for one, and counts the rest', () => {
    expect(leftOutsideSentence(1)).toContain("One video already set up as this client's sits");
    expect(leftOutsideSentence(3)).toContain("3 videos already set up as this client's sit");
  });

  /* It reports and stops: nothing is changed, and no path is quoted back at him. */
  it('says the folder was not changed, and names no path or command', () => {
    const said = leftOutsideSentence(2) ?? '';
    expect(said).toContain('Nothing has been changed');
    expect(said).not.toMatch(/\//);
    expect(said).not.toMatch(/npm |terminal|quit|restart/i);
  });
});

/**
 * **The two folder rules, ordered rather than balanced.**
 *
 * Block 12 session 81 found K2 Syndicalia told that three videos sat outside its
 * folder, one of them the reel `mismatchedClient` says is Dr Loubna Kfafi's
 * footage attached to K2. Both rules read the same fact and drew opposite
 * conclusions: one that the reel is on the wrong client, the other that K2's
 * folder is too narrow to hold it. Only the first is true, and widening K2's
 * folder to take in Dr Loubna's would be the worst answer available.
 */
describe('a video that looks like another client’s', () => {
  /* Deep enough that the two share a real folder, so only the rule under test decides. */
  const HERS = '/Framopia/Clients/Loubna';
  const THEIRS = '/Framopia/Clients/K2';
  const clients = [
    { id: 'loubna', name: 'Loubna', videoFolder: HERS },
    { id: 'k2', name: 'K2', videoFolder: THEIRS },
  ];

  it('is not counted against the client it is attached to', () => {
    expect(
      videosLeftOutside({
        clientId: 'k2',
        videoFolder: THEIRS,
        setUpAs: [{ clientId: 'k2', videoPath: `${HERS}/September/sora.mov` }],
        clients,
      }),
    ).toEqual([]);
  });

  /* Without the clients there is nothing to ask, and it counts as it used to. */
  it('is counted when no client folders are given to ask', () => {
    expect(
      videosLeftOutside({
        clientId: 'k2',
        videoFolder: THEIRS,
        setUpAs: [{ clientId: 'k2', videoPath: `${HERS}/September/sora.mov` }],
      }),
    ).toEqual([`${HERS}/September/sora.mov`]);
  });

  /* A video in nobody's declared folder is still evidence about this one. */
  it('still counts a video no client claims', () => {
    expect(
      videosLeftOutside({
        clientId: 'k2',
        videoFolder: `${THEIRS}/Inputs`,
        setUpAs: [{ clientId: 'k2', videoPath: `${THEIRS}/September/two.mov` }],
        clients,
      }),
    ).toEqual([`${THEIRS}/September/two.mov`]);
  });
});

/**
 * **The sentence promises a folder further up, so there has to be one.**
 *
 * Two of the three K2 was warned about were reels whose videos live in the
 * operating system's temporary directory. The first thing those paths have in
 * common with a client folder on an external disk is the root of the filesystem,
 * and "a folder further up would take them in" is then not a warning but false
 * advice.
 */
describe('a video nowhere near the declared folder', () => {
  const THEIRS = '/Volumes/T7 Shield/Framopia/Clients/K2';

  it('is not counted when the two meet only at the root', () => {
    expect(
      videosLeftOutside({
        clientId: 'k2',
        videoFolder: THEIRS,
        setUpAs: [{ clientId: 'k2', videoPath: '/var/folders/41/scratch/a video.mov' }],
      }),
    ).toEqual([]);
  });

  /* Two disks are the same Mac, not the same folder. */
  it('is not counted when the two meet only at the disks', () => {
    expect(
      videosLeftOutside({
        clientId: 'k2',
        videoFolder: THEIRS,
        setUpAs: [{ clientId: 'k2', videoPath: '/Volumes/Another Disk/K2/a video.mov' }],
      }),
    ).toEqual([]);
  });

  it('is counted when the two share a real folder on the disk', () => {
    const stray = '/Volumes/T7 Shield/Framopia/Clients/K2 elsewhere/a video.mov';
    expect(
      videosLeftOutside({ clientId: 'k2', videoFolder: THEIRS, setUpAs: [{ clientId: 'k2', videoPath: stray }] }),
    ).toEqual([stray]);
  });

  /* The case the warning exists for is untouched by either exclusion. */
  it('still warns about footage in the client’s own tree', () => {
    const HERS = '/Volumes/T7 Shield/Framopia/Clients/Loubna';
    expect(
      videosLeftOutside({
        clientId: 'loubna',
        videoFolder: `${HERS}/September/Exports/Work in Progress`,
        setUpAs: [{ clientId: 'loubna', videoPath: `${HERS}/Inputs/Footages/sora.mov` }],
        clients: [{ id: 'loubna', name: 'Loubna', videoFolder: `${HERS}/September/Exports/Work in Progress` }],
      }),
    ).toEqual([`${HERS}/Inputs/Footages/sora.mov`]);
  });
});
