/**
 * **The tool's language, turned into his.**
 *
 * Block 13 session 95. Mohamed has made four real client videos and the panel
 * still talks to him the way the code talks to itself: `skipped`, `waiting`,
 * `not part of this run`, `Keywords and image slots`, and — when something goes
 * wrong — *"1 slot idea(s) depict more than one subject: slot 7"*.
 *
 * **Everything here is presentation.** Nothing in this file decides anything: no
 * price, no count, no rule. It takes a value the service computed and chooses
 * the words for it. That is the line this session does not cross, and it is why
 * this is a panel module and not a service one — the service's strings are
 * asserted on by the service's own tests, and moving them would be logic.
 *
 * The test for every sentence in here is whether his partner, who is not an
 * engineer, could read it and know what to do.
 */

/** What each stage of a run is actually doing, said as a job rather than a name. */
const STAGE_NAMES: Record<string, string> = {
  transcription: 'Writing down the words',
  analysis: 'Choosing what to emphasise and what to picture',
  images: 'Drawing the pictures',
  zones: 'Finding you in the picture',
  build: 'Putting the composition together',
};

/**
 * `Transcribe and correct`, `Keywords and image slots`, `Generate images` and
 * `Looking at the video` are the service's own labels and they name the
 * machinery. An unknown id falls back to whatever the service called it rather
 * than to nothing, so a stage added later is still readable.
 */
export function stageName(id: string, fallback: string): string {
  return STAGE_NAMES[id] ?? fallback;
}

export type RunState = 'waiting' | 'running' | 'done' | 'skipped' | 'failed';

/**
 * Where a stage has got to, in words — **and never a bare status.**
 *
 * `skipped` was the worst of them: it means "this was already done and costs
 * nothing", which is good news, and it reads like something went wrong.
 */
export function runStateWords(state: RunState, reason?: string | null): string {
  if (state === 'done') return 'Done';
  if (state === 'running') return 'Doing this now';
  if (state === 'failed') return 'Stopped here';
  if (state === 'waiting') return 'Still to do';
  return skippedWords(reason ?? null);
}

/**
 * Why a stage did not need to run. The service's reasons are short and internal;
 * these say the same thing as good news, which is what they are.
 */
export function skippedWords(reason: string | null): string {
  if (reason === null) return 'Nothing to do';
  const said: Record<string, string> = {
    'not part of this run': 'Not needed this time',
    'already on the plan': 'Already done — nothing to pay',
    cached: 'Already paid for — nothing to pay',
    'no plan': 'Nothing to do yet',
    'no plan to analyse': 'Nothing to do yet',
    'no plan to illustrate': 'Nothing to do yet',
    'no image slots on the plan': 'No pictures were wanted',
  };
  return said[reason] ?? 'Nothing to do';
}

/** What a run will do to a stage before it starts, said as money or as nothing. */
export function willDoWords(options: {
  action: 'skip' | 'reuse' | 'run';
  estimateUsd: number | null;
}): string {
  if (options.action === 'skip') return 'Already done — nothing to pay';
  if (options.action === 'reuse') return 'Already paid for — nothing to pay';
  if (options.estimateUsd === null || options.estimateUsd === 0) return 'Free';
  return `About ${money(options.estimateUsd)}`;
}

/**
 * **Money to the cent.** `$3.4025` is four decimal places of a number he cannot
 * act on; the cent is the unit he actually thinks in. The grand total on the
 * money screen keeps its full precision, because that is the figure that has to
 * reconcile with the record — and it is formatted there, not here.
 */
export function money(usd: number): string {
  return `$${usd.toFixed(2)}`;
}

/**
 * **An internal message never reaches the screen raw.**
 *
 * Each entry is a cause the tool can actually produce, matched on what is stable
 * about it, and turned into one sentence saying what happened and **one thing to
 * do**. Anything unmatched falls through to a sentence that is honest about not
 * knowing rather than to the raw text.
 */
const CAUSES: { when: RegExp; say: string }[] = [
  {
    when: /depict more than one subject/i,
    say:
      'One of the picture ideas asked for two things in a single picture, so it was left out. ' +
      'The rest were made. Run the pictures again and a fresh idea is asked for.',
  },
  {
    when: /\bfetch failed\b|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up/i,
    say: 'The connection dropped. Nothing was lost and nothing extra was charged. Try it again.',
  },
  {
    when: /\b5\d\d\b|Service Unavailable/i,
    say: 'The service we use was busy and turned it away. Nothing was charged. Try it again shortly.',
  },
  {
    when: /not authori[sz]ed|API key|invalid key|permission denied/i,
    say: 'The key for the paid services was not accepted. Check it on the Settings screen.',
  },
  {
    when: /would be crossed|ceiling|budget exceeded/i,
    say:
      'This would have cost more than the limit set for one video, so nothing was spent. ' +
      'Raise the limit or use a shorter video.',
  },
  {
    when: /ENOENT|no such file|does not exist|cannot find/i,
    say:
      'A file it needed was not where it expected. If the drive is unplugged, plug it in and ' +
      'press Refresh.',
  },
  {
    when: /no video called|there is no reel/i,
    say: 'That video is not there any more. Press Refresh and choose it again.',
  },
  {
    when: /discard editor work|would discard/i,
    say:
      'You have already chosen pictures for this video, and running it again would throw those ' +
      'choices away. Nothing was changed.',
  },
  {
    when: /face masks|no masks|segmentation/i,
    say:
      'It has not looked at this video yet, so it does not know where you are in the frame. ' +
      'Make the pictures for it and that happens first.',
  },
];

/**
 * The cause as he should read it. **Never returns the raw text**: a cause nobody
 * has written words for still gets a sentence, and the raw text is kept out of
 * the sentence rather than appended to it — a message that ends in a stack-shaped
 * fragment reads as a crash whatever the first half said.
 */
/**
 * **Some causes were already written for him, and those pass through.**
 *
 * "Never raw" means never the *tool's* language. Block 7 session 32 wrote the
 * picture-tools crash as a sentence a person can read — which step died, that it
 * was killed, and that it wrote nothing — after the exit status went unread for
 * a whole block. Replacing that with a general apology would throw away the one
 * message that says which half of the tool broke, and would be a regression
 * dressed as an improvement. Its own test caught exactly that here.
 */
const ALREADY_HIS_WORDS = [/^the picture tools stopped/i];

export function causeWords(cause: string | null | undefined): string {
  if (cause === undefined || cause === null || cause.trim() === '') {
    return 'It stopped and did not say why. Nothing else was changed.';
  }
  for (const written of ALREADY_HIS_WORDS) {
    if (written.test(cause.trim())) return cause;
  }
  for (const entry of CAUSES) {
    if (entry.when.test(cause)) return entry.say;
  }
  return 'It stopped before finishing. Nothing you have already paid for is lost.';
}

/**
 * Whether a control is about to spend real money.
 *
 * **Colour carries one meaning and this is it.** `Make the pictures — about
 * $2.17` and `Make the subtitles again — about $0.00` were the same red; one of
 * them spends two dollars and the other is free.
 */
export function spendsMoney(estimateUsd: number | null | undefined): boolean {
  return typeof estimateUsd === 'number' && estimateUsd > 0;
}
