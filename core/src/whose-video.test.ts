import { describe, expect, it } from 'vitest';
import path from 'node:path';
import {
  mismatchSentence,
  mismatchedClient,
  reattachSentence,
  whoseVideo,
  type ClientFolder,
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
