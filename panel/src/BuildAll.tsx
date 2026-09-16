import { useState, type JSX } from 'react';
import { shortLabels } from './video-names.js';
import { causeWords } from './words.js';
import type { BuildQueueView } from './service.js';

/**
 * **Build every finished video, one press.**
 *
 * Block 14 session 114. Mohamed works principally in queues and said the panel
 * is not smooth and not logical. Session 114 counted the walk on his own panel:
 * **ten videos cost 81 actions, 39 of them crossings between screens — and 40 of
 * the 81 were building them one at a time.** The run queue saved him the
 * watching and never saved him the work.
 *
 * **It is free, and it says so by not being red.** Colour means *this spends
 * money* on every screen in this panel; building reads a plan and writes an
 * `.aep`, so this control is the ordinary one. It is the reason the queue stops
 * before building in the first place — Mohamed's ruling of 2026-09-13, that
 * building is where he looks at what was made.
 *
 * **He can still build one at a time.** The composition card below is untouched
 * and does exactly what it did; this is an addition, not a replacement, because
 * looking at one before the rest is a thing he does.
 *
 * **After Effects runs one script at a time**, so they go one after another. That
 * is what the line under each row is saying, and it is a hard limit rather than a
 * decision — two builds at once would interleave inside one application.
 */
export function BuildAll({
  ready,
  view,
  starting,
  error,
  onBuildAll,
  onStop,
}: {
  /** The videos a list has finished, that have a plan to build from. */
  ready: { reel: string; planPath: string; modeId?: string }[];
  /** The list being built now, if one is. */
  view: BuildQueueView | null;
  starting: boolean;
  error: string | null;
  onBuildAll: (items: { reel: string; planPath: string; modeId?: string }[]) => void;
  onStop: () => void;
}): JSX.Element | null {
  const [stopping, setStopping] = useState(false);
  if (view === null && ready.length === 0) return null;

  const shown = shortLabels(
    (view === null ? ready : view.items).map((i) => i.reel),
  );

  if (view !== null) {
    const built = view.items.filter((i) => i.outcome === 'built').length;
    const failed = view.items.filter((i) => i.outcome === 'failed').length;
    return (
      <div className="buildall">
        <span className="colourhead">Building them all</span>
        <ul className="facts">
          {view.items.map((item, i) => (
            <li key={item.reel}>
              <span className="k" title={item.reel}>
                {shown.get(item.reel) ?? item.reel}
              </span>
              <span className={`v ${toneOf(item.outcome)}`}>
                {wordFor(item.outcome, view.buildingIndex === i)}
                {item.outcome === 'failed' && item.error !== undefined ? (
                  <em className="where">{causeWords(item.error)}</em>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
        {view.done ? (
          <p className="faint" role="status">
            {sentenceFor(built, failed, view.stopped)}
          </p>
        ) : (
          <>
            <p className="faint">
              They are built one after another, because After Effects runs one at a
              time.
            </p>
            <button
              className="ghost"
              type="button"
              disabled={stopping}
              onClick={() => {
                setStopping(true);
                onStop();
              }}
            >
              {stopping ? 'Stopping after this one…' : 'Stop after this one'}
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="buildall">
      <span className="colourhead">Building them all</span>
      <p className="faint">
        {ready.length === 1
          ? 'One video from your list is ready to build.'
          : `${String(ready.length)} videos from your list are ready to build.`}
      </p>
      <ul className="facts">
        {ready.map((item) => (
          <li key={item.reel}>
            <span className="k" title={item.reel}>
              {shown.get(item.reel) ?? item.reel}
            </span>
            <span className="v">ready</span>
          </li>
        ))}
      </ul>
      <button
        className="ghost"
        type="button"
        disabled={starting}
        onClick={() => {
          if (starting) return;
          onBuildAll(ready);
        }}
      >
        {starting
          ? 'Starting…'
          : ready.length === 1
            ? 'Build it'
            : `Build all ${String(ready.length)}`}
      </button>
      {error === null ? null : (
        <p className="reason" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Session 95's rule: a state word he can act on, never the tool's own. */
function wordFor(outcome: string, buildingNow: boolean): string {
  if (buildingNow) return 'Building…';
  if (outcome === 'built') return 'Built';
  if (outcome === 'failed') return 'Did not build';
  if (outcome === 'stopped') return 'You stopped before this one';
  return 'Waiting';
}

/** Never the accent — that means money, and none of this spends any. */
function toneOf(outcome: string): string {
  if (outcome === 'built') return 'good';
  if (outcome === 'failed' || outcome === 'stopped') return 'warn';
  return '';
}

export function sentenceFor(built: number, failed: number, stopped: boolean): string {
  const made = built === 1 ? '1 composition is ready' : `${String(built)} compositions are ready`;
  if (failed > 0) {
    return `${made}. ${String(failed)} did not build — ${failed === 1 ? 'it is' : 'they are'} named above.`;
  }
  if (stopped) return `${made}. You stopped before the rest.`;
  return `${made}.`;
}
