import { useEffect, useState } from 'react';
import {
  addKeyword,
  fetchKeywords,
  removeKeyword,
  type Connection,
} from './service.js';
import type { KeywordsView } from './types.js';

/**
 * Step 3. Which words are emphasised and what template each takes.
 *
 * **Keywords are silent** since Block 8 session 27: the user removed the hits,
 * so there is no binding to show and no absence to explain.
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
          subtitle&apos;s {view.subtitleFontSize}, and is silent.
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
            <span className="ktext" dir={keyword.script === 'arabic' ? 'rtl' : 'ltr'}>
              {keyword.text}
            </span>
            {/*
              `k001` and `g022` are names from the code, and the size is a
              number nobody can read without units. What is worth keeping is
              when it is on screen and how big it is drawn.
            */}
            <span className="wmeta">
              at {keyword.start.toFixed(1)}s
              <em className="tag">{keyword.script === 'arabic' ? 'Arabic' : 'Latin'}</em>
              <em className="tag">{keyword.fontSize} px</em>
              {keyword.kind === null ? null : <em className="tag">{keyword.kind}</em>}
              {keyword.edited ? <em className="tag edited">edited</em> : null}
              {keyword.reason === '' ? (
                <em className="src">promoted by hand</em>
              ) : (
                <em className="src">{keyword.reason}</em>
              )}
            </span>
            <span className="wactions">
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

/**
 * Where these words came from.
 *
 * It used to read `From analysis prompt v4, mode auto, stage done —
 * analysis-590f79bed5eed690 (compatible).` — five facts, four of them names
 * from the code, and the user had to ask what `cacheProvenance` meant. None of
 * them changes anything he can do here. What does is whether these were chosen
 * for him or are waiting for him to choose.
 */
export function sourceLine(view: KeywordsView): string {
  if (view.source.stageStatus !== 'done') {
    return 'These have not been worked out for this video yet.';
  }
  return view.source.mode === 'auto'
    ? 'Chosen for you. Remove any you disagree with, and add your own below.'
    : 'Suggested for you. Nothing is emphasised until you pick it.';
}

