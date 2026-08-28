import { useEffect, useState } from 'react';
import {
  addKeyword,
  fetchKeywords,
  removeKeyword,
  type Connection,
} from './service.js';
import type { KeywordsView, KeywordSfxView } from './types.js';

/**
 * Step 3. Which words are emphasised, what template each takes, and what sound
 * fires with it.
 *
 * Every figure is the service's, derived from the plan. The panel renders it
 * and posts the two edits — promote a word, drop a keyword — back.
 */
export function Keywords({
  connection,
  reel,
}: {
  connection: Connection | null;
  reel: string | null;
}): JSX.Element {
  const [view, setView] = useState<KeywordsView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  useEffect(() => {
    if (connection === null || reel === null) {
      setView(null);
      return;
    }
    let live = true;
    void fetchKeywords(connection, reel).then(
      (next) => {
        if (!live) return;
        setView(next);
        setError(null);
      },
      (failure: Error) => {
        if (!live) return;
        setView(null);
        setError(failure.message);
      },
    );
    return () => {
      live = false;
    };
  }, [connection, reel]);

  if (error !== null) {
    return (
      <p className="reason" role="status">
        {error}
      </p>
    );
  }
  if (view === null) {
    return <p className="empty">Reading the keywords…</p>;
  }
  if (!Array.isArray(view.keywords) || !Array.isArray(view.promotable)) {
    return (
      <p className="reason" role="status">
        The service answered without keywords for this reel.
      </p>
    );
  }

  const drop = (keywordId: string): void => {
    if (connection === null) return;
    void removeKeyword(connection, { planPath: view.planPath, keywordId }).then(setView, (f: Error) =>
      setError(f.message),
    );
  };

  const promote = (wordId: string): void => {
    if (connection === null) return;
    void addKeyword(connection, { planPath: view.planPath, wordId }).then(
      (next) => {
        setView(next);
        setAdding(false);
      },
      (f: Error) => setError(f.message),
    );
  };

  return (
    <>
      <div className="card">
        <p className="promise">
          {view.keywords.length} emphasised {view.keywords.length === 1 ? 'word' : 'words'}. A
          keyword replaces its subtitle card, renders at {view.keywordFontSize} against the
          subtitle&apos;s {view.subtitleFontSize}, and fires a hit.
        </p>
        {/* Where the choice came from, per guidelines §3. */}
        <p className="reason">
          {sourceLine(view)}
        </p>
      </div>

      {view.emptyReason === null ? null : (
        <div className="card" style={{ marginTop: 12 }}>
          <p className="detail" role="status">
            {view.emptyReason}
          </p>
        </div>
      )}

      <ol className="keywords">
        {view.keywords.map((keyword) => (
          <li key={keyword.id} className="keyword">
            <span className="wid">{keyword.id}</span>
            <span className="ktext" dir={keyword.script === 'arabic' ? 'rtl' : 'ltr'}>
              {keyword.text}
            </span>
            <span className="wmeta">
              {keyword.start.toFixed(3)}–{keyword.end.toFixed(3)}s
              {keyword.cardId === null ? null : <em className="tag">{keyword.cardId}</em>}
              <em className="tag">{keyword.templateId ?? 'no template'}</em>
              <em className="tag">{keyword.fontSize}</em>
              {keyword.kind === null ? null : <em className="tag">{keyword.kind}</em>}
              {keyword.edited ? <em className="tag edited">edited</em> : null}
              {keyword.reason === '' ? (
                <em className="src">promoted by hand</em>
              ) : (
                <em className="src">{keyword.reason}</em>
              )}
              {keyword.sfx === null ? (
                <em className="tag">no sfx</em>
              ) : (
                <em className="src">{sfxLine(keyword.sfx)}</em>
              )}
            </span>
            <span className="wactions">
              {keyword.sfx === null || !keyword.sfx.fileExists ? null : (
                <button
                  type="button"
                  className="chip"
                  aria-label={`Play ${keyword.sfx.sfxId}`}
                  onClick={() => play(keyword.sfx as KeywordSfxView, setAudioError)}
                >
                  Play
                </button>
              )}
              <button
                type="button"
                className="chip"
                aria-label={`Remove ${keyword.id}`}
                onClick={() => drop(keyword.id)}
              >
                Remove
              </button>
            </span>
          </li>
        ))}
      </ol>

      {audioError === null ? null : (
        <p className="reason" role="status">
          {audioError}
        </p>
      )}

      <div className="card" style={{ marginTop: 12 }}>
        <button type="button" className="chip" onClick={() => setAdding(!adding)}>
          {adding ? 'Cancel' : 'Emphasise another word'}
        </button>
        {!adding ? null : (
          <ol className="words" style={{ marginTop: 10 }}>
            {view.promotable.map((word) => (
              <li key={word.wordId} className="word">
                <span className="wid">{word.wordId}</span>
                <span
                  className="wtext"
                  dir={word.script === 'arabic' ? 'rtl' : 'ltr'}
                  style={{ padding: '2px 4px' }}
                >
                  {word.text}
                </span>
                <span className="wmeta">
                  {word.start.toFixed(3)}–{word.end.toFixed(3)}s
                  {word.cardId === null ? null : <em className="tag">{word.cardId}</em>}
                </span>
                <span className="wactions">
                  <button
                    type="button"
                    className="chip"
                    aria-label={`Emphasise ${word.wordId}`}
                    onClick={() => promote(word.wordId)}
                  >
                    Emphasise
                  </button>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </>
  );
}

export function sourceLine(view: KeywordsView): string {
  const entry =
    view.source.cacheEntryId === null
      ? 'no analysis cache entry recorded on the plan'
      : `${view.source.cacheEntryId} (${view.source.cacheProvenance ?? 'provenance unrecorded'})`;
  return `From analysis prompt v${view.source.promptVersion}, mode ${view.source.mode}, stage ${view.source.stageStatus} — ${entry}.`;
}

/** The binding, in words, whether or not the sound can be played. */
export function sfxLine(sfx: KeywordSfxView): string {
  const peak =
    sfx.peakOffsetS === null
      ? ', peak unmeasured'
      : `, peak ${sfx.peakOffsetS.toFixed(3)}s into the file`;
  return `${sfx.sfxId} at +${sfx.offsetS.toFixed(2)}s, ${sfx.gainDb} dB${peak}`;
}

/** How much of the run-up to keep before the peak. Chosen, not measured. */
const PREVIEW_LEAD_S = 0.2;

/**
 * Plays the bound sound at its own gain.
 *
 * The panel cannot play through After Effects, so this is the browser's own
 * audio element pointed at the file on disk. It works from a `file://` page
 * because the manifest declares `allow-file-access-from-files`; a failure is
 * reported rather than swallowed, so a control that cannot work says so instead
 * of doing nothing.
 */
function play(sfx: KeywordSfxView, onError: (message: string | null) => void): void {
  try {
    const audio = new Audio(`file://${sfx.file}`);
    // -20 dB is a tenth of full scale; the same figure the build applies.
    audio.volume = Math.min(1, Math.max(0, 10 ** (sfx.gainDb / 20)));
    /*
     * Seeks to just before the measured peak rather than playing from the
     * file's start. `hit_01`'s loudest point is 2.05 s in, so playing from zero
     * is two seconds of run-up before the sound being judged.
     */
    if (sfx.peakOffsetS !== null && sfx.peakOffsetS > PREVIEW_LEAD_S) {
      audio.addEventListener('loadedmetadata', () => {
        audio.currentTime = (sfx.peakOffsetS as number) - PREVIEW_LEAD_S;
      });
    }
    audio.addEventListener('error', () =>
      onError(`Could not play ${sfx.file}. The build still uses it at ${sfx.gainDb} dB.`),
    );
    onError(null);
    void audio.play().catch(() =>
      onError(`Could not play ${sfx.file}. The build still uses it at ${sfx.gainDb} dB.`),
    );
  } catch {
    onError(`Could not play ${sfx.file}. The build still uses it at ${sfx.gainDb} dB.`);
  }
}
