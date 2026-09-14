import type { JSX } from 'react';
import { shortLabels } from './video-names.js';
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
}

export interface QueueView {
  items: QueueItemView[];
  runningIndex: number | null;
  spentUsd: number;
  done: boolean;
  stopped: boolean;
  /** The service's own words, when it is finished. */
  summary?: { headline: string; lines: { reel: string; said: string; needsHim: boolean }[]; spentSaid: string };
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
}: {
  view: QueueView;
  onStop: () => void;
  stopping: boolean;
  /** Takes him to the screen the finished-queue sentence names. */
  onGoTo?: (screen: 'choose' | 'run' | 'build') => void;
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
        <strong>The queue</strong>
        <em className="tag">
          {view.done
            ? `${String(view.items.length)} video${view.items.length === 1 ? '' : 's'}, finished`
            : `${String(view.items.length)} video${view.items.length === 1 ? '' : 's'}`}
        </em>
      </p>

      {/* While it runs: what it is on, and what has been spent so far. */}
      {view.done ? null : (
        <>
          <p className="reason" role="status">
            {running === undefined || running === null
              ? 'Starting.'
              : `Working on ${nameOf(running.reel)}. You can close this and come back — it keeps going.`}
          </p>
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
                <span className={`v ${line.needsHim ? 'warn' : 'ok'}`}>{line.said}</span>
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
