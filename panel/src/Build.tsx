import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchBuildJob, startBuild, type Connection } from './service.js';
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
}: {
  connection: Connection | null;
  preview: BuildPreview | undefined;
  disabled: boolean;
  disabledReason: string | null;
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
      {preview === undefined ? (
        <p className="note" role="status">
          This service is older than the Build control. Restart it and reopen the panel.
        </p>
      ) : (
        <BuildPreviewCard preview={preview} />
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

function BuildPreviewCard({ preview }: { preview: BuildPreview }): JSX.Element {
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
          ? 'No watermark on this reel.'
          : `Watermark ${preview.watermark.size}, ` +
            `${preview.watermark.widthPx} × ${preview.watermark.heightPx} px.`}
      </p>
      <p className="detail">
        Type set in {preview.fonts.latin} and {preview.fonts.arabic}
        {preview.fonts.globalFallback ? ', the standard pair' : ''}.
      </p>
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

function BuildDone({ detail }: { detail: BuildProgress }): JSX.Element {
  return (
    <div className="card" role="status">
      <p className="detail">
        Built in {(detail.wallS ?? 0).toFixed(1)}s.
        {detail.savePath === null ? '' : ` Saved to ${detail.savePath}.`}
      </p>
      {detail.savedOwnOutput === null ? null : (
        <p className="detail">
          Your previous build was open with unsaved changes, so it was saved first:{' '}
          {detail.savedOwnOutput}
        </p>
      )}
      <p className="note">
        Nothing was rendered and the project was not opened — open it in After Effects when you
        want to look at it.
      </p>
    </div>
  );
}
