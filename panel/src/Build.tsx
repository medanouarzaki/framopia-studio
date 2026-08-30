import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchBuildJob, startBuild, updateClientLook, type Connection } from './service.js';
import type { BuildJob, BuildPreview, BuildProgress } from './types.js';

/**
 * Step 5. Building drives the After Effects this panel is running inside, over
 * AppleScript, through the same CLI a terminal runs — so what happens here and
 * what happens in a terminal cannot drift.
 *
 * It produces a composition **for human review**. Nothing is rendered and the
 * file is not opened: the user goes to it when he is ready.
 */
export function Build({
  connection,
  preview,
  disabled,
  disabledReason,
  issues,
  ready,
  stale,
  onClientLookUpdated,
}: {
  connection: Connection | null;
  preview: BuildPreview | undefined;
  disabled: boolean;
  disabledReason: string | null;
  /** Whether a video and a client have been picked at all. */
  ready: boolean;
  /** Set when the service is running older code than this panel. */
  stale: string | null;
  /** Cards the builder will have to squeeze, named rather than counted. */
  issues: string[];
  /** Called after the video is brought up to the client's current look. */
  onClientLookUpdated?: () => void;
}): JSX.Element {
  const [job, setJob] = useState<BuildJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const poll = useCallback(
    async (id: string): Promise<void> => {
      if (connection === null) return;
      try {
        const next = await fetchBuildJob(connection, id);
        setJob(next);
        if (next.status === 'pending' || next.status === 'running') {
          timer.current = setTimeout(() => void poll(id), 500);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [connection],
  );

  const onBuild = useCallback(async (): Promise<void> => {
    if (connection === null || preview === undefined) return;
    setError(null);
    setJob(null);
    setStarting(true);
    try {
      const id = await startBuild(connection, {
        reel: preview.reel,
        planPath: preview.planPath,
        mode: preview.modeId,
      });
      await poll(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStarting(false);
    }
  }, [connection, preview, poll]);

  const running = starting || job?.status === 'pending' || job?.status === 'running';
  const detail = job?.detail;
  // A service older than the requirements check sends nothing, and nothing is
  // not a clean bill of health — it only means this panel cannot say.
  const missing = preview?.missing ?? [];
  const blocked = disabled || missing.length > 0;

  return (
    <div className="buildpane">
      {/*
        Three different reasons there is no preview, and they used to be one
        sentence. The user restarted the service, reopened the panel, and was
        told the service was old — because he had not picked a video yet.
      */}
      {preview === undefined ? (
        <p className="note" role="status">
          {!ready
            ? 'Choose a client and a video above, and this will say what the composition will contain.'
            : (stale ??
              'The companion service did not say what this build would contain. Quit After Effects and open it again.')}
        </p>
      ) : (
        <BuildPreviewCard
          preview={preview}
          connection={connection}
          {...(onClientLookUpdated === undefined ? {} : { onClientLookUpdated })}
        />
      )}

      {missing.length === 0 ? null : (
        <div className="card missing" role="alert">
          <p className="detail">
            This reel is not ready to build. {missing.length === 1 ? 'One thing is' : `${missing.length} things are`} missing,
            and building without {missing.length === 1 ? 'it' : 'them'} would make a comp that
            looks right and is not.
          </p>
          <ul className="issues">
            {missing.map((m) => (
              <li key={m.id}>
                <span className="what">{m.what}</span>
                <span className="detail">Without it, {m.consequence}.</span>
                <code>{m.command}</code>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        className="build-now"
        type="button"
        disabled={blocked || running || connection === null || preview === undefined}
        onClick={() => void onBuild()}
      >
        {running ? 'Building…' : 'Build the composition'}
      </button>
      {disabled && missing.length === 0 && disabledReason !== null ? (
        <p className="reason" role="status">
          {disabledReason}
        </p>
      ) : null}

      {issues.length === 0 ? null : (
        <details className="quibbles">
          <summary>
            {issues.length} {issues.length === 1 ? 'card is' : 'cards are'} too short to hold
          </summary>
          <ul className="issues">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </details>
      )}

      {detail === undefined ? null : <BuildStages detail={detail} />}
      {job?.status === 'done' && detail !== undefined ? <BuildDone detail={detail} /> : null}
      {job?.status === 'error' || error !== null ? (
        <p className="reason" role="alert">
          {error ?? job?.error ?? 'The build failed and said nothing.'}
        </p>
      ) : null}
    </div>
  );
}

function BuildPreviewCard({
  preview,
  connection,
  onClientLookUpdated,
}: {
  preview: BuildPreview;
  connection: Connection | null;
  onClientLookUpdated?: () => void;
}): JSX.Element {
  const parts = [
    `${preview.subtitleCards} subtitle cards`,
    `${preview.keywords} emphasised ${preview.keywords === 1 ? 'keyword' : 'keywords'}`,
    `${preview.images} ${preview.images === 1 ? 'image' : 'images'}`,
    `${preview.sfxEvents} ${preview.sfxEvents === 1 ? 'sound' : 'sounds'}`,
  ];
  return (
    <div className="card">
      <p className="detail">
        {preview.reel}, for {preview.modeName} — the client recorded on {preview.modeSource}.
      </p>
      <p className="detail">Will contain {parts.join(', ')}.</p>
      <p className="detail">
        {preview.watermark === null
          ? 'No watermark on this video.'
          : `Watermark ${preview.watermark.size}, ` +
            `${preview.watermark.widthPx} × ${preview.watermark.heightPx} px.`}
      </p>
      <p className="detail">
        Type set in {preview.fonts.latin} and {preview.fonts.arabic}
        {preview.fonts.emphasis === undefined || preview.fonts.emphasis === preview.fonts.latin
          ? ''
          : `, with ${preview.fonts.emphasis} for emphasised words`}
        {preview.fonts.globalFallback ? ', the standard pair' : ''}.
      </p>
      <ClientLook
        preview={preview}
        connection={connection}
        onClientLookUpdated={onClientLookUpdated}
      />
      <p className="detail">
        Writes {preview.outputPath}, replacing what is there.
      </p>
      {/*
        Every other control in this panel that runs something can spend money,
        so saying nothing about cost would itself be read as a cost.
      */}
      <p className="detail">Building is free. It calls nothing and bills nothing.</p>
    </div>
  );
}

/**
 * Which of the client's looks this video is built with.
 *
 * A video keeps the look the client had when it was set up, so a video approved
 * months ago rebuilds as it was approved. That is only safe if the panel says
 * so, and only useful if there is one control that moves it forward — which is
 * a thing a person presses, never something a run does.
 *
 * No version numbers on screen: "as it was set up" and "as it is now" are the
 * two states, and they are what he is actually choosing between.
 */
function ClientLook({
  preview,
  connection,
  onClientLookUpdated,
}: {
  preview: BuildPreview;
  connection: Connection | null;
  onClientLookUpdated?: () => void;
}): JSX.Element | null {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const client = preview.client;
  if (client === undefined) return null;
  if (client.source === 'none') {
    return <p className="detail">No client saved for this video yet.</p>;
  }
  if (client.source === 'live-mode') {
    return (
      <p className="detail">
        This video has no saved copy of {client.name}’s look, so it follows whatever the
        client says today. Running the pipeline saves one.
      </p>
    );
  }
  return (
    <>
      <p className="detail">
        Built with {client.name}’s look as it was when this video was set up.
      </p>
      {client.behind === true ? (
        <p className="detail">
          {client.name} has changed since. This video keeps the older look until you say
          otherwise.{' '}
          <button
            type="button"
            className="ghost"
            disabled={busy || connection === null}
            onClick={() => {
              if (connection === null) return;
              setBusy(true);
              setFailed(null);
              void updateClientLook(connection, { planPath: preview.planPath })
                .then(() => onClientLookUpdated?.())
                .catch((e: unknown) => setFailed(e instanceof Error ? e.message : String(e)))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? 'Updating…' : 'Use the client’s look as it is now'}
          </button>
        </p>
      ) : null}
      {failed === null ? null : <p className="detail">{failed}</p>}
    </>
  );
}

function BuildStages({ detail }: { detail: BuildProgress }): JSX.Element {
  return (
    <ol className="stages">
      {detail.stages.map((stage) => (
        <li key={stage.id} className={stage.state}>
          <span className="state" aria-hidden="true" />
          <span className="label">{stage.label}</span>
        </li>
      ))}
    </ol>
  );
}

/*
 * The file is the deliverable. Nothing in this system renders, so a saved
 * project is how a reel leaves it — which makes naming the file the last step
 * of the job rather than a detail under it. The build reports the path After
 * Effects actually wrote to, read back from the project rather than echoed
 * from what it was asked, and until Block 9 session 14 it reported nothing at
 * all and this sentence was always empty.
 */
function BuildDone({ detail }: { detail: BuildProgress }): JSX.Element {
  return (
    <div className="card" role="status">
      <p className="detail">Built in {(detail.wallS ?? 0).toFixed(1)}s.</p>
      {detail.savePath === null ? (
        <p className="detail">
          The build finished but did not say where it saved. Look in .local/build for the
          newest file.
        </p>
      ) : (
        <>
          <p className="note">Your composition is here</p>
          <p className="savepath">{detail.savePath}</p>
        </>
      )}
      {detail.savedOwnOutput === null ? null : (
        <p className="detail">
          Your previous build was open with unsaved changes, so it was saved first:{' '}
          {detail.savedOwnOutput}
        </p>
      )}
      <p className="note">
        It is open in After Effects now, and nothing was rendered.
      </p>
    </div>
  );
}
