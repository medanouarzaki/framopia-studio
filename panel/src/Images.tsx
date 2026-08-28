import { useEffect, useState } from 'react';
import { chooseImage, chooseImageSide, fetchImages, type Connection } from './service.js';
import { fileUrl, pictureFor } from './picture.js';
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

  const moveTo = (slotId: string, band: 'above' | 'left' | 'right' | null): void => {
    if (connection === null) return;
    setError(null);
    void chooseImageSide(connection, { planPath: view.planPath, slotId, band }).then(
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
            <Slot slot={slot} view={view} onChoose={choose} onMove={moveTo} />
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
  onMove,
}: {
  slot: ImageSlotView;
  view: ImagesView;
  onChoose: (slotId: string, candidateId: string | null) => void;
  onMove: (slotId: string, band: 'above' | 'left' | 'right' | null) => void;
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
        {slot.nothingIsMeasured === true
          ? ' Nothing is checked automatically about these pictures — judge them by eye.'
          : ''}
      </p>

      <Where slot={slot} onMove={onMove} />

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
                <Candidate candidate={candidate} slot={slot} />
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

/**
 * Where the picture sits, and the other sides of the speaker it could sit on.
 *
 * **These are sides, not the stored zones.** Twenty of those exist on
 * `vitasilk`, derived from the person mask, and placement has not read them
 * since Block 7 session 9 — it works from the face mask now. Offering a list of
 * rectangles would be a control pretending to a choice that no longer exists;
 * the real choice is which side of the speaker, and how big each one lets the
 * picture be.
 */
function Where({
  slot,
  onMove,
}: {
  slot: ImageSlotView;
  onMove: (slotId: string, band: 'above' | 'left' | 'right' | null) => void;
}): JSX.Element | null {
  const options = slot.placementOptions;
  if (slot.placedWhere == null || options === undefined) return null;
  const current = options.find((o) => o.label === slot.placedWhere);
  return (
    <div className="where">
      <p className="reason">
        Sits <strong>{slot.placedWhere}</strong>
        {slot.placedSidePx == null ? '' : `, ${slot.placedSidePx} px across`}
        {slot.placementChosenByHuman === true
          ? ' — your choice.'
          : ' — the roomiest side, picked for you.'}
      </p>
      <div className="wactions">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            className="chip"
            disabled={!option.usable || option.label === current?.label}
            aria-label={`Put ${slot.id} ${option.label}`}
            onClick={() => onMove(slot.id, option.key)}
          >
            {option.label} · {option.sidePx} px
          </button>
        ))}
        {slot.placementChosenByHuman === true ? (
          <button
            type="button"
            className="chip"
            aria-label={`Let the tool choose for ${slot.id}`}
            onClick={() => onMove(slot.id, null)}
          >
            let the tool choose
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Candidate({
  candidate,
  slot,
}: {
  candidate: CandidateView;
  slot: ImageSlotView;
}): JSX.Element {
  const rendersAsCutout = slot.rendersAsCutout ?? slot.presentation === 'cutout';
  // The raw picture is worth a second look only where it differs from what
  // gets built, which is a cutout slot. On a card slot the two are the same
  // file and showing it twice would say the build does something it does not.
  const showRaw = rendersAsCutout && candidate.imageExists !== false;
  const picture = pictureFor(slot, candidate);
  const [unreadable, setUnreadable] = useState(false);
  return (
    <div className="cbody">
      <div className="shots">
        {picture.state === 'ready' && !unreadable ? (
          <img
            className={rendersAsCutout ? 'shot built cut' : 'shot built'}
            src={fileUrl(picture.path)}
            alt={`${candidate.id} as it will look`}
            onError={() => setUnreadable(true)}
          />
        ) : (
          /*
           * Three different facts, said as three different sentences. Session
           * 31 collapsed them into "missing from the disk" and told the user he
           * had lost ten pictures that were all present.
           */
          <span className="tag">
            {picture.state === 'absent'
              ? 'this picture is no longer on the disk'
              : picture.state === 'unnamed'
                ? 'the panel could not work out which picture this is — restart the service'
                : 'this picture is on the disk but the panel could not display it'}
          </span>
        )}
        {showRaw ? (
          <figure className="rawshot">
            <img
              className="shot"
              src={fileUrl(candidate.imagePath)}
              alt={`${candidate.id} before the background was removed`}
            />
            <figcaption className="src">before the background was removed</figcaption>
          </figure>
        ) : null}
      </div>
      <p className="slothead">
        <strong>{candidate.id}</strong>
        {candidate.qualityApplies === true ? (
          <em className={candidate.backgroundCameAwayCleanly === true ? 'tag pass' : 'tag reject'}>
            {candidate.backgroundCameAwayCleanly === true
              ? 'background came away cleanly'
              : 'background did not come away cleanly'}
          </em>
        ) : null}
      </p>
      {/* Only where it changes what gets built. On a slot that shows the whole
          picture the matte is never drawn, so a threshold it misses says
          nothing about what the user will see. */}
      {candidate.qualityApplies === true && (candidate.problems ?? []).length > 0 ? (
        <p className="reason">{(candidate.problems ?? []).join('; ')}</p>
      ) : null}
      {(candidate.unexpectedText ?? []).length === 0 ? null : (
        <p className="src">
          words visible in the picture that the idea did not ask for:{' '}
          {(candidate.unexpectedText ?? []).slice(0, 8).join(', ')}
          {(candidate.unexpectedText ?? []).length > 8
            ? ` and ${(candidate.unexpectedText ?? []).length - 8} more`
            : ''}
        </p>
      )}
    </div>
  );
}

/**
 * Where the pictures came from, in words.
 *
 * The cache entry id and its provenance are deliberately not here. They are
 * provenance for an artifact and the plan records them; on screen they were two
 * identifiers the user had to ask about, and neither changes a decision he can
 * make.
 */
export function sourceLine(view: ImagesView): string {
  const client =
    view.source.clientMode === null
      ? 'This plan does not say which client it is for.'
      : `Made for ${view.source.clientMode}.`;
  const spent =
    view.reelSpentUsd === null
      ? ''
      : ` $${view.reelSpentUsd.toFixed(2)} spent generating pictures for this reel so far.`;
  return `${client}${spent}`;
}
