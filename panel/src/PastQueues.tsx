import type { JSX } from 'react';
import { shortLabels } from './video-names.js';
import { videosLeftIn, type QueueRecordView } from './service.js';

/**
 * **Every queue that has run, kept forever.**
 *
 * Mohamed's ruling of 2026-09-15. He was told it is a record of real spending,
 * that it is a few lines of text per video — measured at **223 bytes a video** —
 * and that if it ever grows unwieldy the answer is folding the old ones out of
 * sight, never deleting them. This is that folding.
 *
 * **Six in view, and the number is measured.** Session 106 got every screen inside
 * the 900 px panel and every session since has held it. Make's daily state is
 * 616 px; six rows with their heading and their fold row cost **93 px**, measured,
 * which puts Make at **709 px** with fifty queues recorded — 191 px still spare.
 *
 * Six rather than more because the spare room is not really 284 px: **Make's worst
 * state, a queue running with its four steps showing, is 896 px.** The record is
 * therefore not drawn at all while a queue runs — the running card is the subject
 * then — and six is what leaves the daily state comfortable rather than what fills
 * it. A row measures 18 px, so this is a decision about margin, not about fit.
 */
export const IN_VIEW = 6;

/** When it ran, without making him do arithmetic on a timestamp. */
export function whenItRan(startedAt: string, now = new Date()): string {
  const then = new Date(startedAt);
  if (Number.isNaN(then.getTime())) return 'at some point';
  const days = Math.floor((startOf(now) - startOf(then)) / 86_400_000);
  const clock = then.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (days === 0) return `today, ${clock}`;
  if (days === 1) return `yesterday, ${clock}`;
  if (days < 7) return `${then.toLocaleDateString(undefined, { weekday: 'long' })}, ${clock}`;
  return then.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

function startOf(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** What became of a queue, in one line: how many, and what it cost. */
export function whatBecameOfIt(record: QueueRecordView): string {
  const items = record.progress.items;
  const ready = items.filter((i) => i.outcome === 'done').length;
  const failed = items.filter((i) => i.outcome === 'failed').length;
  const parts = [`${String(ready)} ready`];
  if (failed > 0) parts.push(`${String(failed)} did not finish`);
  if (record.progress.stopped) parts.push('stopped');
  if (record.finishedAt === null && !record.progress.done) parts.push('still going');
  return `${parts.join(', ')} · $${record.progress.spentUsd.toFixed(2)}`;
}

/**
 * The record, under the queue it belongs to: the recent ones in view, the rest
 * behind the one disclosure this panel uses.
 */
export function PastQueues({
  records,
  onResume,
  resuming,
}: {
  records: QueueRecordView[];
  /**
   * Carries on a queue the record shows unfinished. Block 14 session 111: session
   * 110 kept everything a resume needs and had nothing that acted on it.
   */
  onResume?: (record: QueueRecordView) => void;
  /** The queue being carried on, so its control cannot be pressed twice. */
  resuming?: string | null;
}): JSX.Element | null {
  if (records.length === 0) return null;
  const recent = records.slice(0, IN_VIEW);
  const older = records.slice(IN_VIEW);
  const shown = shortLabels(records.flatMap((r) => r.progress.items.map((i) => i.reel)));
  const row = (record: QueueRecordView): JSX.Element => (
    <li key={record.id}>
      <span className="k" title={record.progress.items.map((i) => shown.get(i.reel) ?? i.reel).join(', ')}>
        {whenItRan(record.startedAt)}
      </span>
      <span className="v">
        {whatBecameOfIt(record)}
        {/*
          **Carry on where it stopped.** Only on a queue that did not finish and
          still has videos that never ran. It runs those and no others, so nothing
          already paid for is bought again — proved for real at Block 14 session
          111: a queue of two stopped after the first, the record named exactly the
          one left, and carrying on ran that alone for $0.0000.
 
          **Two guards, and both are needed.** The `disabled` below stops the
          second press; the `resuming` check in the handler stops a press that
          arrives another way. Session 111 removed them one at a time: taking the
          handler's guard alone left the test green, which is how it learned that a
          test passing is not the same as a guard working.
        */}
        {onResume === undefined || videosLeftIn(record).length === 0 || record.progress.done
          ? null
          : (
            <button
              type="button"
              className="chip"
              disabled={resuming !== null && resuming !== undefined}
              aria-label={`Carry on ${whenItRan(record.startedAt)}`}
              onClick={() => onResume(record)}
            >
              {resuming === record.id ? 'Starting…' : 'Carry on'}
            </button>
          )}
      </span>
    </li>
  );
  return (
    <div className="pastqueues">
      <span className="colourhead">Queues you have run</span>
      <ul className="facts">{recent.map(row)}</ul>
      {older.length === 0 ? null : (
        <details className="quibbles">
          <summary>{`${String(older.length)} older`}</summary>
          <ul className="facts">{older.map(row)}</ul>
        </details>
      )}
    </div>
  );
}
