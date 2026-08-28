import { useEffect, useState } from 'react';
import { fetchTranscript, saveCard, saveWord, type Connection } from './service.js';
import type { OpenQuestion, TranscriptView, TranscriptWordView } from './types.js';

/**
 * Step 2. The first screen with the user's own content on it, and the first
 * place the alignment work of sessions 12–17 is visible on the words rather
 * than in a report.
 *
 * Everything shown is derived by the service from the Edit Plan; this renders
 * it and posts edits back. Nothing about the transcript is decided here.
 */
export function Transcript({
  connection,
  reel,
}: {
  connection: Connection | null;
  reel: string | null;
}): JSX.Element {
  const [view, setView] = useState<TranscriptView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<OpenQuestion['id'] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (connection === null || reel === null) {
      setView(null);
      return;
    }
    let live = true;
    void fetchTranscript(connection, reel).then(
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
    return <p className="empty">Reading the transcript…</p>;
  }
  /*
   * A payload without these is not a shape the service produces, but the panel
   * is the only surface the user has and a malformed answer must read as an
   * empty transcript rather than an unmounted React tree. The same rule that
   * keeps the startup path from throwing, applied to the service's replies.
   */
  if (!Array.isArray(view.words) || !Array.isArray(view.cards)) {
    return (
      <p className="reason" role="status">
        The service answered without a transcript for this reel.
      </p>
    );
  }

  const questions = Array.isArray(view.questions) ? view.questions : [];
  const marked =
    filter === null ? null : new Set(questions.find((q) => q.id === filter)?.wordIds ?? []);
  const shown = marked === null ? view.words : view.words.filter((w) => marked.has(w.id));
  const cardById = new Map(view.cards.map((c) => [c.id, c]));

  const commit = (word: TranscriptWordView): void => {
    if (connection === null || draft.trim() === '' || draft === word.text) {
      setEditing(null);
      return;
    }
    void saveWord(connection, { planPath: view.planPath, wordId: word.id, text: draft }).then(
      (result) => {
        setView({
          ...view,
          transcriptHash: result.hash,
          words: view.words.map((w) => (w.id === word.id ? result.word : w)),
        });
        setEditing(null);
      },
      (failure: Error) => setError(failure.message),
    );
  };

  const restore = (word: TranscriptWordView): void => {
    if (connection === null) return;
    void saveWord(connection, { planPath: view.planPath, wordId: word.id, restore: true }).then(
      (result) =>
        setView({
          ...view,
          transcriptHash: result.hash,
          words: view.words.map((w) => (w.id === word.id ? result.word : w)),
        }),
      (failure: Error) => setError(failure.message),
    );
  };

  const nudge = (cardId: string, deltaS: number): void => {
    if (connection === null) return;
    const card = cardById.get(cardId);
    if (card === undefined) return;
    const start = card.displayStart ?? card.start;
    const end = (card.displayEnd ?? card.end) + deltaS;
    if (end <= start) return;
    void saveCard(connection, { planPath: view.planPath, cardId, displayStart: start, displayEnd: end }).then(
      (next) => setView({ ...view, cards: view.cards.map((c) => (c.id === cardId ? next : c)) }),
      (failure: Error) => setError(failure.message),
    );
  };

  return (
    <>
      <div className="card">
        <p className="promise">
          {view.words.length} words in {view.cards.length} cards. A word&apos;s own script sets its
          direction, so Arabic reads right to left inside the line.
        </p>
        {/* Said before he types, not after he has paid for it. */}
        <p className="note">{view.editCost}</p>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <p className="promise">
          Three things to rule on. Pick one to see only those words. Counts are for this
          reel, with the whole corpus beside them.
        </p>
        <ul className="questions">
          {questions.map((q) => (
            <li key={q.id}>
              <button
                type="button"
                className={filter === q.id ? 'chip on' : 'chip'}
                aria-pressed={filter === q.id}
                onClick={() => setFilter(filter === q.id ? null : q.id)}
              >
                {/*
                 * Both scopes, always. The screen showed 1, 5 and 0 for
                 * vitasilk while the record said 7, 23 and 13; both were right
                 * and nothing said which was which.
                 */}
                {q.label} · <strong>{q.count}</strong> this reel · {q.corpusCount} corpus
                {q.proxy ? ' · proxy' : ''}
              </button>
              {filter === q.id ? (
                <>
                  <p className="detail">{q.question}</p>
                  <p className="reason">{q.basis}</p>
                  {q.count === 0 ? (
                    <p className="reason">None on this reel.</p>
                  ) : (
                    <ul className="instances">
                      {q.instances.map((instance) => (
                        <li key={instance.wordIds.join('-')}>
                          <span
                            className="itext"
                            dir={/[\u0600-\u06FF]/.test(instance.text) ? 'rtl' : 'ltr'}
                          >
                            {instance.text}
                          </span>
                          <span className="idetail">{instance.detail}</span>
                          {instance.parts === undefined ? null : (
                            <span className="iparts">
                              {instance.parts.map((part) => (
                                <em key={part.cardId}>
                                  {part.cardId}
                                  <span dir="rtl">{part.text}</span>
                                </em>
                              ))}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      <ol className="words">
        {shown.map((word) => {
          const card = word.cardId === null ? null : cardById.get(word.cardId);
          return (
            <li key={word.id} className={word.removed ? 'word removed' : 'word'}>
              <span className="wid">{word.id}</span>
              {editing === word.id ? (
                <input
                  className="wtext"
                  aria-label={`Text of ${word.id}`}
                  value={draft}
                  dir={word.script === 'arabic' ? 'rtl' : 'ltr'}
                  autoFocus
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => commit(word)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commit(word);
                    if (e.key === 'Escape') setEditing(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  className={`wtext ${confidenceClass(word.confidence)}`}
                  /* Per token, never on the line: a container dir would flip
                     the Latin words around it. */
                  dir={word.script === 'arabic' ? 'rtl' : 'ltr'}
                  title={`${word.lang ?? 'lang unknown'} · ${word.script}`}
                  onClick={() => {
                    setEditing(word.id);
                    setDraft(word.text);
                  }}
                >
                  {word.text}
                </button>
              )}
              <span className="wmeta">
                {word.start.toFixed(3)}–{word.end.toFixed(3)}s
                {word.interpolated ? (
                  <em className="tag">interpolated</em>
                ) : (
                  <em className="src" dir="rtl">
                    {word.sourceText ?? ''}
                  </em>
                )}
                {word.edited ? <em className="tag edited">edited</em> : null}
                {card?.holdClipped === true ? <em className="tag">hold clipped</em> : null}
                {word.removed ? <em className="tag">{word.removedReason ?? 'removed'}</em> : null}
              </span>
              <span className="wactions">
                {word.removed ? (
                  <button type="button" className="chip" onClick={() => restore(word)}>
                    Restore
                  </button>
                ) : null}
                {card === undefined || card === null ? null : (
                  <>
                    <button
                      type="button"
                      className="chip"
                      aria-label={`Shorten ${card.id}`}
                      onClick={() => nudge(card.id, -0.05)}
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="chip"
                      aria-label={`Lengthen ${card.id}`}
                      onClick={() => nudge(card.id, 0.05)}
                    >
                      +
                    </button>
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </>
  );
}

/**
 * Confidence from the aligner, in four bands: null (no anchor, so never
 * measured), and thirds of the measured range. **Not red** — the accent is Run
 * pipeline's, and a low-confidence word is a thing to look at rather than an
 * error.
 */
export function confidenceClass(confidence: number | null): string {
  if (confidence === null) return 'conf-none';
  if (confidence >= 0.9) return 'conf-high';
  if (confidence >= 0.7) return 'conf-mid';
  return 'conf-low';
}
