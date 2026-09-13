import { describe, expect, it } from 'vitest';
import {
  causeWords,
  money,
  runStateWords,
  skippedWords,
  spendsMoney,
  stageName,
  willDoWords,
} from './words.js';

describe('the names of the stages', () => {
  /* `Keywords and image slots` names the machinery, not the job. */
  it('says what each stage is doing, not what it is called', () => {
    expect(stageName('transcription', 'Transcribe and correct')).toBe('Writing down the words');
    expect(stageName('analysis', 'Keywords and image slots')).toBe(
      'Choosing what to emphasise and what to picture',
    );
    expect(stageName('images', 'Generate images')).toBe('Drawing the pictures');
    expect(stageName('zones', 'Looking at the video')).toBe('Finding you in the picture');
  });

  it('falls back to the service’s own label for a stage it has no words for', () => {
    expect(stageName('something-new', 'Something New')).toBe('Something New');
  });
});

describe('where a stage has got to', () => {
  /**
   * **Not every status word was wrong — `done` is exactly what he would say.**
   * The four that were wrong are here: `skipped` reads as a fault when it is
   * good news, `waiting` and `failed` say nothing about what to do, and
   * `running…` is a word plus an ellipsis standing in for a position.
   */
  it('never says skipped, waiting, failed or running at him', () => {
    const said = [
      runStateWords('waiting'),
      runStateWords('running'),
      runStateWords('failed'),
      runStateWords('skipped', 'already on the plan'),
    ];
    for (const s of said) {
      expect(s).not.toMatch(/^(waiting|running…?|failed|skipped)$/i);
    }
    expect(runStateWords('done')).toBe('Done');
  });

  /**
   * **`skipped` was the worst of them.** It means the work was already done and
   * costs nothing, which is good news, and it read like something went wrong.
   */
  it('says a skipped stage is good news, not a fault', () => {
    expect(skippedWords('already on the plan')).toBe('Already done — nothing to pay');
    expect(skippedWords('cached')).toBe('Already paid for — nothing to pay');
    expect(skippedWords('not part of this run')).toBe('Not needed this time');
  });

  it('has words for every reason the runner can give', () => {
    /* Every `reason:` string in pipeline.ts, so a new one is noticed here. */
    for (const reason of [
      'not part of this run',
      'already on the plan',
      'no plan to analyse',
      'no image slots on the plan',
      'no plan to illustrate',
      'no plan',
      'cached',
    ]) {
      expect(`${reason}: ${skippedWords(reason)}`).not.toBe(`${reason}: ${reason}`);
    }
  });

  it('still says something for a reason nobody has written words for', () => {
    expect(skippedWords('some reason invented later')).toBe('Nothing to do');
    expect(skippedWords(null)).toBe('Nothing to do');
  });
});

describe('what a run will do before it starts', () => {
  it('says nothing to pay when there is nothing to pay', () => {
    expect(willDoWords({ action: 'skip', estimateUsd: null })).toBe(
      'Already done — nothing to pay',
    );
    expect(willDoWords({ action: 'reuse', estimateUsd: 0 })).toBe(
      'Already paid for — nothing to pay',
    );
    expect(willDoWords({ action: 'run', estimateUsd: 0 })).toBe('Free');
  });

  it('says the money to the cent', () => {
    expect(willDoWords({ action: 'run', estimateUsd: 2.1708 })).toBe('About $2.17');
  });
});

describe('money', () => {
  /* $3.4025 is four decimals of a number he cannot act on. */
  it('is to the cent', () => {
    expect(money(3.4025)).toBe('$3.40');
    expect(money(2.1268)).toBe('$2.13');
    expect(money(0)).toBe('$0.00');
  });
});

describe('colour carries one meaning', () => {
  it('is true only when real money is about to be spent', () => {
    expect(spendsMoney(2.17)).toBe(true);
    expect(spendsMoney(0)).toBe(false);
    expect(spendsMoney(null)).toBe(false);
    expect(spendsMoney(undefined)).toBe(false);
  });
});

/**
 * **An internal message never reaches the screen raw.** The example Mohamed
 * named is the first of these.
 */
describe('what went wrong, in his words', () => {
  const raw =
    '1 slot idea(s) depict more than one subject: img007 ("Sculptra and Lanluma") — and. ' +
    'The mode asks for one subject, centred and unobstructed.';

  it('turns the multi-subject error into something he can act on', () => {
    const said = causeWords(raw);
    expect(said).toBe(
      'One of the picture ideas asked for two things in a single picture, so it was left out. ' +
        'The rest were made. Run the pictures again and a fresh idea is asked for.',
    );
    expect(said).not.toContain('slot');
    expect(said).not.toContain('img007');
    expect(said).not.toContain('mode');
  });

  it('says what to do about a connection that dropped', () => {
    expect(causeWords('fetch failed')).toContain('Try it again');
    expect(causeWords('fetch failed')).toContain('nothing extra was charged');
  });

  it('does not repeat the raw text back to him, ever', () => {
    for (const cause of [
      raw,
      'fetch failed',
      'ENOENT: no such file or directory, open /x/y',
      'the model returned 503 Service Unavailable',
      'SlotsReplaceBlockedError: would discard editor work on 8 slot(s)',
      'a cause nobody has written words for, with Error: and a stack',
    ]) {
      const said = causeWords(cause);
      expect(`${cause.slice(0, 20)}: ${said.includes(cause)}`).toBe(
        `${cause.slice(0, 20)}: false`,
      );
    }
  });

  it('says something honest when there is no cause at all', () => {
    expect(causeWords(null)).toContain('did not say why');
    expect(causeWords('')).toContain('did not say why');
    expect(causeWords(undefined)).toContain('did not say why');
  });

  /* Session 91: no message may name a command or send him out of the panel. */
  it('names no command and sends him nowhere', () => {
    const all = [
      ...['transcription', 'analysis', 'images', 'zones', 'build'].map((i) => stageName(i, i)),
      runStateWords('waiting'),
      runStateWords('failed'),
      skippedWords('already on the plan'),
      causeWords('fetch failed'),
      causeWords('not authorised'),
      causeWords('ENOENT: no such file'),
      causeWords(null),
    ].join(' ');
    expect(all).not.toMatch(/npm run|terminal|quit|restart|reopen|relaunch/i);
  });
});

/**
 * **A message already written for him is not replaced by a general one.**
 *
 * Block 7 session 32 wrote the picture-tools crash as a sentence a person can
 * read, after the exit status went unread for a whole block. Session 95's first
 * attempt at `causeWords` swallowed it and returned a general apology instead —
 * its own browser test caught that, and this pins it so the next rewrite cannot
 * lose it again.
 */
describe('a cause that is already in his words', () => {
  const sidecar =
    'the picture tools stopped during segment_person — it was killed by SIGABRT, and wrote nothing';

  it('passes through untouched', () => {
    expect(causeWords(sidecar)).toBe(sidecar);
  });

  it('keeps what it says about which half broke', () => {
    const said = causeWords(sidecar);
    expect(said).toContain('segment_person');
    expect(said).toContain('killed by SIGABRT');
    expect(said).toContain('wrote nothing');
  });
});
