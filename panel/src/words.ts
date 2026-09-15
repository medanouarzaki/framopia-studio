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
    /*
     * **The one Mohamed has actually hit.** Session 111 ran into a real 429
     * while proving a resume: the Google account's prepayment credits were
     * depleted. It fell through to *"It stopped before finishing"* — true, and
     * it left him to work out on his own that pressing again would fail the
     * same way every time.
     *
     * It must come after the 5xx rule, not before: a busy service and an empty
     * account are the opposite instruction — one says try again shortly, the
     * other says trying again is the one thing that will not help.
     */
    when: /\b429\b|RESOURCE_EXHAUSTED|exceeded your current quota|quota exceeded|insufficient credit/i,
    say:
      'The paid service turned it away because the account has no credit left. Nothing was ' +
      'charged and nothing already paid for is lost. It will keep refusing until the account ' +
      'has credit again.',
  },
  {
    when: /not authori[sz]ed|API key|invalid key|permission denied/i,
    /*
     * **It sent him to a screen that does not exist.** Block 13 session 102 found
     * it and was not allowed to reword it; session 103 is. There is no Settings
     * screen in this panel — no component, no route, nothing named Settings
     * anywhere in `panel/src`.
     *
     * And there cannot be one that shows him the key: a secret lives only in
     * `.local/` and is never printed. So the true sentence says what is wrong and
     * what has to happen, and sends him nowhere — which is better than sending
     * him somewhere that is not there.
     */
    say:
      'The key for the paid services was not accepted. Nothing here can change it — the key ' +
      'itself has to be replaced before anything that costs money will run.',
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

export interface QueueNews {
  /** Short enough to sit on a step, which is a third of a 420 px panel. */
  short: string;
  /** The same thing said properly, for a screen reader and a tooltip. */
  said: string;
  /** `working`, `good` or `warn`. Never the accent — that means money. */
  tone: 'working' | 'good' | 'warn';
}

/**
 * **What the steps say about a queue he is not looking at.**
 *
 * Block 13 session 98. Session 97 chose never to move him between screens — being
 * carried off mid-sentence is worse than one press — and the consequence was that
 * two hours of unattended work could finish in silence while he was on Choose or
 * had the panel shut. The step carries the news instead, so nothing moves and
 * nothing is lost.
 *
 * **Running, finished-clean and finished-with-failures are three different pieces
 * of news** and they read differently: a queue that ended with a video failed is
 * not the same as one that ended clean, and he should not have to open it to find
 * out which.
 *
 * **The tone is never the accent.** Red means *this spends money* — Mohamed's
 * screens have one colour with one meaning — so a failure is `warn`, the amber
 * already declared in `panel.css`, and never the red that a paid button uses.
 *
 * Returns `null` when there is nothing to say, which is most of the time.
 */
export function queueNews(queue: {
  items: { outcome: 'done' | 'failed' | 'stopped' | 'not-reached' }[];
  done: boolean;
  stopped: boolean;
} | null): QueueNews | null {
  if (queue === null) return null;
  const total = queue.items.length;
  if (total === 0) return null;
  const done = queue.items.filter((i) => i.outcome === 'done').length;
  const failed = queue.items.filter((i) => i.outcome === 'failed').length;

  if (!queue.done) {
    const finished = queue.items.filter((i) => i.outcome !== 'not-reached').length;
    return {
      short: `${String(finished)}/${String(total)}`,
      said: `Making videos — ${String(finished)} of ${String(total)} so far.`,
      tone: 'working',
    };
  }
  if (failed > 0) {
    return {
      short: `${String(failed)} failed`,
      said: `${String(done)} ready to build, ${String(failed)} did not finish.`,
      tone: 'warn',
    };
  }
  if (queue.stopped) {
    return {
      short: 'stopped',
      said: `You stopped the list. ${String(done)} ready to build.`,
      tone: 'warn',
    };
  }
  return {
    short: `${String(done)} ready`,
    said: `${String(done)} ${done === 1 ? 'video is' : 'videos are'} ready to build.`,
    tone: 'good',
  };
}

/**
 * **When the companion service is not answering.**
 *
 * Block 13 session 100. This is the state Mohamed has photographed more than any
 * other, and session 99 measured it at **211 px — nearly a third of the panel** —
 * of which the first line was the service's own error text, raw:
 * `{state.error.cause}`. Session 95 built `causeWords` for exactly that and it was
 * never applied here.
 *
 * **It is not proportionate.** A helper that usually starts on its own in a few
 * seconds does not deserve a third of the screen, and an error is not more
 * important than the work.
 *
 * So: one sentence he can act on, and the raw text kept where it can be looked up
 * rather than read past.
 */
export function serviceDownWords(cause: string | null | undefined, retryable: boolean): string {
  const said = (cause ?? '').trim();
  /*
   * Two of the causes that reach here are already written for a person — the
   * Node help in `core/`, and `serviceTrouble`'s sentences — and replacing those
   * with something general would throw away the only instruction available.
   * Session 95 learned this when its first `causeWords` swallowed the
   * picture-tools crash.
   */
  if (/^No Node interpreter could be found/.test(said)) return said;
  if (/^the panel is using an old connection|^the companion service ran into trouble|^there is nothing here/.test(said)) {
    return said;
  }
  if (/\bfetch failed\b|Failed to fetch|ECONNREFUSED|ECONNRESET|socket hang up|not answering/i.test(said)) {
    return 'The companion service has not answered yet. It usually starts on its own.';
  }
  if (/ENOENT|EACCES|spawn|not built|cannot find/i.test(said)) {
    return 'The companion service could not be started on this Mac.';
  }
  if (retryable) return 'The companion service stopped answering. It usually clears on its own.';
  return 'The companion service cannot start, and trying again will not help.';
}

/**
 * **How many times it has looked, said as a person would.**
 *
 * It read `attempt 3 at 14:23:05` — the tool's own bookkeeping, on his screen.
 * Returns `null` for the first look, because "first check" is noise: of course it
 * is the first.
 */
export function triedWords(attempt: number, at: string): string | null {
  if (attempt <= 0) return null;
  const times = attempt + 1;
  return `Looked ${times === 2 ? 'twice' : `${String(times)} times`}, last at ${at}.`;
}

/**
 * **An empty state teaches; it does not apologise.**
 *
 * His partner meets the first of these on his first open, and today it is
 * *"No clients set up yet"* inside a dropdown with nothing saying what to do.
 * Nothing here may be a dead end.
 */
export function nothingYetWords(what: 'clients' | 'videos' | 'no-folder'): {
  said: string;
  next: string;
} {
  if (what === 'clients') {
    return {
      said: 'No clients yet.',
      next: 'Start by setting one up — their name, their colours, and the folder their videos are in.',
    };
  }
  if (what === 'no-folder') {
    return {
      said: 'This client has no video folder yet.',
      next: 'Open their card above and set the folder their videos are in, then press Refresh.',
    };
  }
  return {
    said: 'No videos in this client’s folder.',
    next: 'Put a video in it and press Refresh, or set a different folder on their card above.',
  };
}

/**
 * **A video that is finished should say so.**
 *
 * Block 13 session 101, and the state he meets every day. A video that has been
 * run shows four rows of *Already done — nothing to pay* and two buttons at
 * *nothing to pay*. Every word is true and together they read as though nothing
 * is there — the tool describing its own idleness rather than his finished work.
 *
 * **It does not list what the composition contains.** Build already says that, in
 * one place, and a fifth place that counts cards would be four places too many.
 * This says the one thing the counts do not: it is done, and the next thing is to
 * build it.
 *
 * Returns `null` whenever anything is still to do, which is when the buttons and
 * the rows are the right thing to read.
 */
export function finishedWords(stages: readonly { status: string }[]): string | null {
  if (stages.length === 0) return null;
  if (!stages.every((s) => s.status === 'done')) return null;
  return 'Everything for this video is made. Go to Build to put the composition together.';
}

/**
 * **Splits a settled sentence around a phrase, so the phrase can be pressed.**
 *
 * Block 13 session 102. Mohamed: *"when I click a button, the next button I'm
 * going to click on should be near to it."* Six sentences in this panel name a
 * place — *Go to Build*, *on their card above*, *Choose a client and a video
 * above* — and a place he has to go and find is the opposite of a target under
 * the pointer that is already there.
 *
 * **This changes no wording.** The sentence is settled; what changes is that one
 * span of it is a control. `before + phrase + after` is the sentence, character
 * for character, and a test asserts exactly that for every phrase the panel
 * makes pressable — so a sentence that is reworded without its phrase being
 * updated goes red rather than silently losing its way there.
 *
 * Returns `null` when the phrase is not in the sentence, which is what a caller
 * renders as plain text: a missing way through is better than a broken one.
 */
export function aroundPhrase(
  sentence: string,
  phrase: string,
): { before: string; phrase: string; after: string } | null {
  const at = sentence.indexOf(phrase);
  if (at === -1) return null;
  return {
    before: sentence.slice(0, at),
    phrase,
    after: sentence.slice(at + phrase.length),
  };
}

/**
 * The phrases this panel turns into a way there, one per sentence that names a
 * place. Named here rather than at each call site so the test that proves they
 * are still in their sentences has one list to walk.
 */
export const WAYS_THERE = {
  build: 'Go to Build',
  theirCard: 'Open their card',
  aDifferentFolder: 'set a different folder on their card',
  clientAndVideo: 'Choose a client and a video',
  /*
   * **There is no button called *Run pipeline*.** Block 13 session 103. Session 95
   * replaced it with *Make the subtitles* and *Make the pictures*, and `App.tsx`
   * says so in its own comment — but this sentence kept naming the old one, and
   * session 102 made it a control without noticing the name was dead.
   */
  runIt: 'Make the subtitles and the pictures',
  pickAVideo: 'Pick a video',
} as const;
