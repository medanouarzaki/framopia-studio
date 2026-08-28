import { useEffect, useState } from 'react';
import { chooseImage, fetchImages, type Connection } from './service.js';
import type { CandidateView, ImageSlotView, ImagesView } from './types.js';

/**
 * Step 4. Which generated image each slot uses.
 *
 * **Rejected candidates are shown, and can be chosen.** The gate rejects 8 of
 * `vitasilk`'s 10 candidates and four of those are genuine halo; hiding them
 * would hide the reason a slot looks the way it does, and would leave no way to
 * disagree with a verdict. The gate advises, the user decides, and a choice
 * that overrides a verdict is recorded as an override.
 *
 * Images load over `file://`, as the keyword picker's audio did — the manifest
 * declares `allow-file-access-from-files`. A file the service says is missing
 * is reported rather than rendered as a broken frame.
 */
export function Images({
  connection,
  reel,
}: {
  connection: Connection | null;
  reel: string | null;
}): JSX.Element {
  const [view, setView] = useState<ImagesView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (connection === null || reel === null) {
      setView(null);
      return;
    }
    let live = true;
    void fetchImages(connection, reel).then(
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
  if (view === null) return <p className="empty">Reading the image slots…</p>;
  if (!Array.isArray(view.slots)) {
    return (
      <p className="reason" role="status">
        The service answered without image slots for this reel.
      </p>
    );
  }

  const choose = (slotId: string, candidateId: string | null): void => {
    if (connection === null) return;
    void chooseImage(connection, { planPath: view.planPath, slotId, candidateId }).then(
      setView,
      (f: Error) => setError(f.message),
    );
  };

  const withCandidates = view.slots.filter((s) => s.candidates.length > 0);
  const chosen = view.slots.filter((s) => s.chosenCandidateId !== null).length;

  return (
    <>
      <div className="card">
        <p className="promise">
          {view.slots.length} image {view.slots.length === 1 ? 'slot' : 'slots'},{' '}
          {withCandidates.length} with candidates generated, {chosen} chosen.
        </p>
        <p className="reason">{sourceLine(view)}</p>
        {view.cardFrameForced ? (
          <p className="reason">
            Each picture is drawn inside a frame. Pick one per slot if you want to change it;
            leave them and the first picture of each is used.
          </p>
        ) : null}
      </div>

      {view.slots.length === 0 ? (
        <p className="empty">
          No image slots on this plan. Analysis plans them; it has not run for this reel.
        </p>
      ) : null}

      <ol className="slots">
        {view.slots.map((slot) => (
          <li key={slot.id}>
            <Slot slot={slot} view={view} onChoose={choose} />
          </li>
        ))}
      </ol>
    </>
  );
}

function Slot({
  slot,
  view,
  onChoose,
}: {
  slot: ImageSlotView;
  view: ImagesView;
  onChoose: (slotId: string, candidateId: string | null) => void;
}): JSX.Element {
  return (
    <div className="card">
      <p className="slothead">
        <strong>{slot.id}</strong>
        <em className="tag">
          on screen {slot.start.toFixed(1)}s to {slot.end.toFixed(1)}s
        </em>
      </p>
      <p className="src">{slot.idea}</p>
      <p className="reason">
        {slot.rendersAsCutout
          ? 'This one is shown with its background removed, so only the subject appears.'
          : 'This one is shown whole, inside a frame.'}
      </p>

      {slot.candidates.length === 0 ? (
        <p className="reason" role="status">
          Nothing generated for this slot.{' '}
          {view.generationEstimateUsd === null
            ? (view.generationNote ?? 'The dry run did not price generating it.')
            : `Generating would cost about $${view.generationEstimateUsd.toFixed(2)}.`}
        </p>
      ) : (
        <>
          <p className="reason">
            Builds with <strong>{slot.buildsWith}</strong> — {slot.buildsWithReason}.
            {slot.overriddenFailures.length > 0
              ? ` Overrides the gate: ${slot.overriddenFailures.join('; ')}.`
              : ''}
          </p>
          <ul className="candidates">
            {slot.candidates.map((candidate) => (
              <li key={candidate.id} className={candidate.chosen ? 'candidate chosen' : 'candidate'}>
                <Candidate candidate={candidate} rendersAsCutout={slot.rendersAsCutout} />
                <div className="wactions">
                  <button
                    type="button"
                    className="chip"
                    aria-label={
                      candidate.chosen ? `Clear ${candidate.id}` : `Choose ${candidate.id}`
                    }
                    onClick={() => onChoose(slot.id, candidate.chosen ? null : candidate.id)}
                  >
                    {candidate.chosen ? 'Chosen' : 'Choose'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Candidate({
  candidate,
  rendersAsCutout,
}: {
  candidate: CandidateView;
  rendersAsCutout: boolean;
}): JSX.Element {
  // The raw picture is worth a second look only where it differs from what
  // gets built, which is a cutout slot. On a card slot the two are the same
  // file and showing it twice would say the build does something it does not.
  const showRaw = rendersAsCutout && candidate.imageExists;
  return (
    <div className="cbody">
      <div className="shots">
        {candidate.renderedExists ? (
          <img
            className={rendersAsCutout ? 'shot built cut' : 'shot built'}
            src={`file://${candidate.renderedPath}`}
            alt={`${candidate.id} as it will look`}
          />
        ) : (
          <span className="tag">this picture is missing from the disk</span>
        )}
        {showRaw ? (
          <figure className="rawshot">
            <img
              className="shot"
              src={`file://${candidate.imagePath}`}
              alt={`${candidate.id} before the background was removed`}
            />
            <figcaption className="src">before the background was removed</figcaption>
          </figure>
        ) : null}
      </div>
      <p className="slothead">
        <strong>{candidate.id}</strong>
        <em className={candidate.gatePassed === true ? 'tag pass' : 'tag reject'}>
          {candidate.gatePassed === null
            ? 'ungated'
            : candidate.gatePassed
              ? 'gate passed'
              : 'gate rejected'}
        </em>
        {candidate.modelId === null ? null : <em className="tag">{candidate.modelId}</em>}
        {candidate.resolution === null ? null : <em className="tag">{candidate.resolution}</em>}
        <em className="tag">
          {candidate.costUsd === null ? 'cost unrecorded' : `$${candidate.costUsd.toFixed(4)}`}
        </em>
      </p>
      {candidate.gateFailures.length === 0 ? null : (
        <p className="reason">{candidate.gateFailures.join('; ')}</p>
      )}
      {candidate.metrics === null ? (
        <p className="src">no metrics recorded</p>
      ) : (
        <p className="src">{metricsLine(candidate)}</p>
      )}
      {candidate.unexpectedText.length === 0 ? null : (
        <p className="src">
          text the idea did not ask for: {candidate.unexpectedText.slice(0, 8).join(', ')}
          {candidate.unexpectedText.length > 8
            ? ` and ${candidate.unexpectedText.length - 8} more`
            : ''}
        </p>
      )}
    </div>
  );
}

/** The four §5.4 metrics, in the order the gate reports them. */
export function metricsLine(candidate: CandidateView): string {
  const m = candidate.metrics;
  if (m === null) return 'no metrics recorded';
  const quality =
    candidate.cutoutQuality === null ? '' : `, headroom ${candidate.cutoutQuality.toFixed(4)}`;
  return (
    `edge noise ${m.alphaEdgeNoise.toFixed(4)}, holes ${m.holeRatio.toFixed(4)}, ` +
    `foreground ${m.foregroundArea.toFixed(4)}, halo ${m.edgeHalo.toFixed(4)}${quality}`
  );
}

/** Where the slots came from, per guidelines §3: a figure names its source. */
export function sourceLine(view: ImagesView): string {
  const client =
    view.source.clientMode === null
      ? 'no client recorded on the plan'
      : `${view.source.clientMode} v${view.source.clientModeVersion}`;
  const spent =
    view.reelSpentUsd === null
      ? 'no image spend recorded'
      : `$${view.reelSpentUsd.toFixed(6)} spent on this reel's images`;
  const entry =
    view.source.cacheEntryId === null
      ? 'no cache entry recorded'
      : `${view.source.cacheEntryId} (${view.source.cacheProvenance ?? 'provenance unrecorded'})`;
  return `Client ${client}, stage ${view.source.stageStatus}, ${spent} — ${entry}.`;
}
