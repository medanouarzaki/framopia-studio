import type { JSX } from 'react';
import { shortLabels } from './video-names.js';
import { stageName } from './words.js';
import { Sentence } from './Sentence.js';
import { WAYS_THERE } from './words.js';

/**
 * **What he comes back to.**
 *
 * Mohamed's ruling of 2026-09-13: the queue runs the ideas and the pictures for
 * every video in it, unattended, and stops before building. He has been told and
 * accepts that **the money is spent before he looks** — so the one thing this
 * screen must never do is make him hunt for what happened.
 *
 * Three questions, in this order, because that is the order he asks them: what is
 * ready to build, what failed and what he would do about it, and what it cost.
 *
 * **The sentences are the service's**, not this file's. Whether a failure is
 * worth trying again is something only the run knows, and a second copy of that
 * judgement in a React bundle is a second place for it to drift — the same reason
 * `wordsStages` lives in the service.
 */
export interface QueueItemView {
  reel: string;
  outcome: 'done' | 'failed' | 'stopped' | 'not-reached';
  spentUsd: number;
  attempts: number;
  startedAt: string | null;
  finishedAt: string | null;
  /**
   * Which of the four stages this video is on, while it is the one running.
   *
   * **Optional with a default.** Block 14 session 110: `2/4` moved once every
   * twenty-six minutes and said nothing in between. A service older than this
   * sends nothing and the panel shows what it always showed.
   */
  stage?: string | null;
}

export interface QueueView {
  items: QueueItemView[];
  /**
   * Set when the record could not be written — the drive went away mid-queue.
   *
   * **Optional with a default.** Block 14 session 111: session 110 measured that a
   * queue keeps spending and stops recording when the disk will not take it, and
   * said so. This is that failure reaching his screen instead of only the report.
   */
  notRecorded?: { since: string; spentUsd: number; why: string } | null;
  runningIndex: number | null;
  spentUsd: number;
  done: boolean;
  stopped: boolean;
  /** The service's own words, when it is finished. */
  summary?: { headline: string; lines: { reel: string; said: string; needsHim: boolean }[]; spentSaid: string };
}

/**
 * The four steps a queued video goes through, in the order it goes through them.
 *
 * The pipeline's own ids, and `stageName` is the one place they are turned into
 * his words — so this cannot drift from what a single run shows him.
 */
const QUEUE_STEPS = ['transcription', 'analysis', 'images', 'zones'] as const;

/**
 * **Whether this video may be tried again.**
 *
 * Only one that actually failed, and only while it has an attempt left. The queue
 * runs a video twice and then records it and moves on — session 94's rule, and
 * session 109 measured that it holds. A one-press retry that ignored it would turn
 * a bounded worst case into an unbounded bill, which is the thing the rule exists
 * to prevent.
 */
export function canTryAgain(view: QueueView, reel: string): boolean {
  const item = view.items.find((i) => i.reel === reel);
  if (item === undefined) return false;
  return item.outcome === 'failed' && item.attempts < QUEUE_ATTEMPTS;
}

/** Two, as the service runs it. One declaration so the two cannot disagree. */
export const QUEUE_ATTEMPTS = 2;

/** Done, doing, or still to come — decided by where the running stage is. */
function stepWordOf(id: string, at: string | null): string {
  if (at === null) return 'waiting';
  const here = QUEUE_STEPS.indexOf(id as (typeof QUEUE_STEPS)[number]);
  const now = QUEUE_STEPS.indexOf(at as (typeof QUEUE_STEPS)[number]);
  if (now === -1) return 'waiting';
  if (here < now) return 'done';
  if (here === now) return 'doing this now';
  return 'waiting';
}

function stepToneOf(id: string, at: string | null): string {
  const word = stepWordOf(id, at);
  /* Never the accent: a step is not a thing that spends. Session 98. */
  return word === 'done' ? 'good' : word === 'doing this now' ? 'warn' : '';
}

function howLong(item: QueueItemView): string | null {
  if (item.startedAt === null || item.finishedAt === null) return null;
  const secs = (Date.parse(item.finishedAt) - Date.parse(item.startedAt)) / 1000;
  if (!Number.isFinite(secs) || secs < 0) return null;
  return secs < 90 ? `${secs.toFixed(0)} seconds` : `${(secs / 60).toFixed(0)} minutes`;
}

export function Queue({
  view,
  onStop,
  stopping,
  onGoTo,
  onTryAgain,
  tryingAgain,
}: {
  view: QueueView;
  onStop: () => void;
  stopping: boolean;
  /** Takes him to the screen the finished-queue sentence names. */
  onGoTo?: (screen: 'choose' | 'run' | 'build') => void;
  /**
   * Runs one failed video again, on its own. Block 14 session 110: session 109
   * measured that a failed video needed a manual re-run, which is four presses and
   * a screen change. Absent on a panel that cannot start one.
   */
  onTryAgain?: (reel: string) => void;
  /** The reel currently being started again, so its control cannot be pressed twice. */
  tryingAgain?: string | null;
}): JSX.Element {
  const running = view.runningIndex === null ? null : view.items[view.runningIndex];
  /*
   * **Shortened against the queue's own rows**, not against the picker's — these
   * are the videos he put in the list, and telling them apart from each other is
   * what a row here has to do. Block 13 session 99. The stored label is what is
   * shown on hover and what everything else still uses.
   */
  const shownName = shortLabels(view.items.map((i) => i.reel));
  const nameOf = (reel: string): string => shownName.get(reel) ?? reel;

  return (
    <div className="card queue">
      <p className="slothead">
        <strong>The list</strong>
        <em className="tag">
          {view.done
            ? `${String(view.items.length)} video${view.items.length === 1 ? '' : 's'}, finished`
            : `${String(view.items.length)} video${view.items.length === 1 ? '' : 's'}`}
        </em>
      </p>

      {/*
        **The record could not be written, and he is told while it is happening.**
        Block 14 session 111. The queue does not stop — a disk problem must not kill
        work that is being paid for, which is session 110's trade and it stands —
        but what has been spent since the last successful write is on screen, so
        the money is not lost with the record.
 
        Not the accent: nothing here is a thing that spends. Session 95's rule.
      */}
      {view.notRecorded == null ? null : (
        <p className="reason warn" role="status">
          This queue is still running, but it cannot write to the disk, so what it
          does is not being recorded. ${view.notRecorded.spentUsd.toFixed(2)} has
          been spent since the record was last saved — write that down.
        </p>
      )}

      {/* While it runs: what it is on, and what has been spent so far. */}
      {view.done ? null : (
        <>
          <p className="reason" role="status">
            {running === undefined || running === null
              ? 'Starting.'
              : `Working on ${nameOf(running.reel)}. You can close this and come back — it keeps going.`}
          </p>
          {/*
            **What it is doing, between the two moments the count changes.** Block
            14 session 110. Block 13 session 94 measured the wait — 25.8 minutes
            from the transcript landing to the masks being made — and for all of it
            the only thing that moved was `2/4`, once.
 
            Steps, not a percentage: the four stages exist, they are already named
            in his words, and a bar that sits still and then jumps is worse than
            saying which step it is on. **Nothing animates** — session 98's rule;
            he may be reading a transcript.
          */}
          {running === undefined || running === null || running.stage == null ? null : (
            <ul className="facts steps">
              {QUEUE_STEPS.map((id) => (
                <li key={id}>
                  <span className="k">{stageName(id, id)}</span>
                  <span className={`v ${stepToneOf(id, running.stage ?? null)}`}>
                    {stepWordOf(id, running.stage ?? null)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="faint">
            Spent so far: ${view.spentUsd.toFixed(2)}.
          </p>
          <button className="run" type="button" onClick={onStop} disabled={stopping}>
            {stopping ? 'Stopping after this video…' : 'Stop after this video'}
          </button>
        </>
      )}

      {/* When it is finished: the three answers, in the service's own words. */}
      {view.done && view.summary !== undefined ? (
        <>
          <p className="reason" role="status">
            {view.summary.headline}
          </p>
          <ul className="facts">
            {view.summary.lines.map((line) => (
              <li key={line.reel}>
                <span className="k" title={line.reel}>{nameOf(line.reel)}</span>
                <span className={`v ${line.needsHim ? 'warn' : 'ok'}`}>
                  {line.said}
                  {/*
                    **One press, on the video it is about.** Block 14 session 110.
                    Session 109 measured that trying a failed video again meant
                    going to Choose, finding it, coming back and pressing Run.
 
                    It starts a queue of one, so everything already paid for is
                    read from the cache and costs nothing — the same path a
                    re-run has taken since sessions 86 and 92. It is offered only
                    on a video that failed and that has attempts left: the queue
                    tries twice and then records and moves on, which is session
                    94's rule and is not weakened by making the third try his.
                  */}
                  {onTryAgain === undefined || !canTryAgain(view, line.reel) ? null : (
                    <button
                      type="button"
                      className="chip"
                      disabled={tryingAgain !== null && tryingAgain !== undefined}
                      aria-label={`Try ${nameOf(line.reel)} again`}
                      onClick={() => onTryAgain(line.reel)}
                    >
                      {tryingAgain === line.reel ? 'Starting…' : 'Try again'}
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p className="faint">{view.summary.spentSaid}</p>
          {/*
            **The next thing, where the news is.** Block 13 session 102. A queue
            finishes and this is what he reads — and the picker it names is not
            above, it is on Choose, behind a tab. The sentence is unchanged;
            *Pick a video* takes him there.
          */}
          <Sentence
            className="faint"
            text="Pick a video above and build it, the same way you always do."
            phrase={WAYS_THERE.pickAVideo}
            onPress={() => onGoTo?.('choose')}
          />
        </>
      ) : null}

      {/* Per video, once it has run: how long it took and what it cost. */}
      <ul className="facts">
        {view.items
          .filter((i) => i.outcome !== 'not-reached')
          .map((item) => (
            <li key={item.reel}>
              <span className="k" title={item.reel}>{nameOf(item.reel)}</span>
              <span className="v">
                {[
                  howLong(item),
                  item.spentUsd > 0 ? `$${item.spentUsd.toFixed(2)}` : 'nothing to pay',
                  item.attempts > 1 ? `tried ${String(item.attempts)} times` : null,
                ]
                  .filter((x) => x !== null)
                  .join(' · ')}
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}
