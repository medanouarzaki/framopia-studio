import { useCallback, useEffect, useState } from 'react';
import { buildFonts } from '@framopia/core/build-fonts';
import {
  connect,
  fetchDryRun,
  fetchJob,
  fetchModes,
  fetchVideos,
  openVideo,
  fetchSteps,
  setWatermark,
  startPipeline,
  type Connection,
} from './service.js';
import { Build } from './Build.js';
import { ClientCard } from './ClientCard.js';
import { NewClient } from './NewClient.js';
import { Readiness } from './Readiness.js';
import { panelBuiltAt, stalenessOf } from './staleness.js';
import { fileDialogSupport, pickVideoFile } from './file-dialog.js';
import { Transcript } from './Transcript.js';
import { Images } from './Images.js';
import { Keywords } from './Keywords.js';


/** How often to notice a service that has gone away. Chosen, not measured. */
const HEARTBEAT_MS = 5000;

/** How often to ask the service how the run is going. Chosen, not measured. */
const JOB_POLL_MS = 1000;
import { runGate } from './run-gate.js';
import { formatUsd, SPEND_SOFT_ALARM_USD, spendLevel } from './spend.js';
import type {
  ClientMode,
  DryRunPlan,
  DryRunStage,
  HostEnvironment,
  PipelineJob,
  PipelineStageReport,
  PlanSteps,
  Reel,
  ServiceState,
  StepId,
  WatermarkSize,
} from './types.js';

/**
 * The whole panel, for now: service state, a video, a client mode, and a Run
 * control that says why it is off.
 *
 * There is deliberately nothing else. No placeholder for the transcript
 * editor, which stays blocked until the aligner is fixed; no dead navigation
 * to stages that do not exist. An empty product that is finished reads better
 * than a full one that is scaffolded, and the user judges this by eye.
 */
export interface AppProps {
  /**
   * Re-run on every Retry, not resolved once at startup.
   *
   * It used to be a value computed at module load, so the host — and with it
   * the repository root — was captured before the user could do anything about
   * it being wrong. Retry re-ran the health check against the same broken host
   * and produced byte-identical text, which is why the button looked dead.
   */
  detect: () => HostEnvironment;
}

export function App({ detect }: AppProps): JSX.Element {
  const [attempt, setAttempt] = useState(0);
  const [env, setEnv] = useState<HostEnvironment>(() => detect());
  const [attemptedAt, setAttemptedAt] = useState<string>(() => new Date().toLocaleTimeString());

  const redetect = useCallback(() => {
    setEnv(detect());
    setAttemptedAt(new Date().toLocaleTimeString());
    setAttempt((n) => n + 1);
  }, [detect]);

  if (!env.available) {
    return <HostUnavailable env={env} attempt={attempt} attemptedAt={attemptedAt} onRetry={redetect} />;
  }
  return <Panel key={attempt} env={env} attempt={attempt} attemptedAt={attemptedAt} onRedetect={redetect} />;
}

function Panel({
  env,
  attempt,
  attemptedAt,
  onRedetect,
}: {
  env: Extract<HostEnvironment, { available: true }>;
  attempt: number;
  attemptedAt: string;
  onRedetect: () => void;
}): JSX.Element {
  const { host, logoSrc } = env;
  const [service, setService] = useState<ServiceState>({ kind: 'starting' });
  const [reels, setReels] = useState<Reel[]>([]);
  const [modes, setModes] = useState<ClientMode[]>([]);
  const [reelLabel, setReelLabel] = useState<string>('');
  const [modeId, setModeId] = useState<string>('');
  const [connection, setConnection] = useState<Connection | null>(null);
  const [dry, setDry] = useState<DryRunPlan | null>(null);
  const [dryError, setDryError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanSteps | null>(null);
  /*
   * Which editor is open over the main screen, or none.
   *
   * There is no remembered step any more. He does not fill in a form: he
   * presses Run, presses Build, watches the comp and comes back to change the
   * one thing that bothered him — so the panel is one screen, and an editor is
   * something you open from it and close again.
   */
  const [editor, setEditor] = useState<EditorId | null>(null);
  /** The client form, when it is open over the main screen. */
  const [newClient, setNewClient] = useState<'permanent' | 'one-off' | null>(null);
  /** What the disk said about the client's folder, and what it would not offer. */
  const [videoNote, setVideoNote] = useState<{
    folder: string | null;
    trouble: string | null;
    skipped: { name: string; why: string }[];
  }>({ folder: null, trouble: null, skipped: [] });

  /*
   * The run lives in the service; this is only the id of the job being watched
   * and the last progress read from it. Leaving step 1 does not stop it, and
   * coming back picks the polling up again.
   */
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<PipelineJob | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  const check = useCallback(async () => {
    setService({ kind: 'starting' });
    const result = await connect(host);
    if (!result.ok) {
      setService({ kind: 'unreachable', error: result.error });
      setConnection(null);
      return;
    }
    setService({ kind: 'healthy', health: result.health, origin: result.origin });
    setConnection({ port: result.port, token: result.token });
  }, [host]);

  useEffect(() => {
    void check();
  }, [check]);

  /*
   * A service that dies while the panel is open would otherwise leave `Ready`
   * on screen indefinitely — the panel checked once and never again. This
   * re-checks quietly; `check` sets `starting` first, so the card would flicker
   * on every tick, and a heartbeat that answers is not worth redrawing for.
   */
  useEffect(() => {
    if (connection === null) return;
    const timer = setInterval(() => {
      void fetch(`http://127.0.0.1:${connection.port}/health`)
        .then((res) => {
          if (!res.ok) throw new Error(`health returned HTTP ${res.status}`);
        })
        .catch((error: Error) => {
          setService({
            kind: 'unreachable',
            error: {
              error: error.message,
              stage: 'service-lost',
              cause: `the service stopped answering: ${error.message}`,
              retryable: true,
            },
          });
          setConnection(null);
        });
    }, HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [connection]);

  /*
   * Both lists come from the service. A list that cannot be read leaves an
   * empty picker, which the screen already words for itself; an unhandled
   * rejection here would take the panel down.
   */
  useEffect(() => {
    if (connection === null) {
      setReels([]);
      setModes([]);
      return;
    }
    void fetchModes(connection).then(setModes, () => setModes([]));
  }, [connection]);

  /*
   * The videos, for whichever client is chosen. Re-read on Refresh and never
   * on a timer: the T7 is not always plugged in, and a watcher would have to
   * decide what to do every time it vanished.
   */
  const loadVideos = useCallback(async (): Promise<void> => {
    if (connection === null) {
      setReels([]);
      return;
    }
    try {
      const listing = await fetchVideos(connection, modeId === '' ? null : modeId);
      setReels(listing.reels);
      setVideoNote({
        folder: listing.folder,
        trouble: listing.trouble,
        skipped: listing.skipped,
      });
    } catch {
      setReels([]);
      setVideoNote({ folder: null, trouble: null, skipped: [] });
    }
  }, [connection, modeId]);

  useEffect(() => {
    void loadVideos();
  }, [loadVideos]);

  const reel = reels.find((r) => r.label === reelLabel) ?? null;
  const mode = modes.find((m) => m.id === modeId) ?? null;

  /* What a run would do, before anything is paid for. It spends nothing. */
  useEffect(() => {
    if (connection === null || reel === null || mode === null) {
      setDry(null);
      setDryError(null);
      return;
    }
    let current = true;
    void fetchDryRun(connection, reel.label, mode.id).then(
      (plan) => {
        if (!current) return;
        setDry(plan);
        setDryError(null);
      },
      (error: Error) => {
        if (!current) return;
        setDry(null);
        setDryError(error.message);
      },
    );
    return () => {
      current = false;
    };
  }, [connection, reel, mode]);

  /*
   * Step state comes from the plan on disk, never from this component. The
   * panel is a view over the plan: closing it, restarting After Effects or
   * reloading the extension must land the user where the reel actually is, and
   * the plan is the only thing that survives all three.
   */
  useEffect(() => {
    if (connection === null || reel === null || mode === null) {
      setPlan(null);
      return;
    }
    let current = true;
    void fetchSteps(connection, reel.label, mode.id).then(
      (next) => {
        if (current) setPlan(next);
      },
      () => {
        if (current) setPlan(null);
      },
    );
    return () => {
      current = false;
    };
  }, [connection, reel, mode]);

  /*
   * Picking a video always shows the main screen.
   *
   * The panel used to remember the step last viewed per reel, so choosing a
   * video could land him on Build with no way of seeing what he had skipped.
   * That behaviour is gone and must not come back in another form.
   */
  useEffect(() => {
    setEditor(null);
  }, [reelLabel, modeId]);

  /* Polls the job while it is unfinished. The service owns the run. */
  useEffect(() => {
    if (connection === null || jobId === null) return;
    let live = true;
    const tick = (): void => {
      void fetchJob(connection, jobId).then(
        (next) => {
          if (!live) return;
          setJob(next);
          if (next.status === 'done' || next.status === 'error') setJobId(null);
        },
        () => {
          /* A poll that fails is not a run that failed; the next tick retries. */
        },
      );
    };
    tick();
    const timer = setInterval(tick, JOB_POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [connection, jobId]);

  /*
   * A finished run changes what the plan supports, so the rail has to be told.
   * This is where `cacheProvenance` first reaches the screen from real data.
   */
  useEffect(() => {
    if (job?.status !== 'done' || connection === null || reel === null || mode === null) return;
    void fetchSteps(connection, reel.label, mode.id).then(setPlan, () => undefined);
    void fetchDryRun(connection, reel.label, mode.id).then(setDry, () => undefined);
  }, [job?.status, connection, reel, mode]);

  const running = job !== null && (job.status === 'running' || job.status === 'pending');
  const gate = runGate({ service, reel, mode, running });
  const onRun = (): void => {
    if (connection === null || reel === null || mode === null) return;
    setStartError(null);
    setJob(null);
    void startPipeline(connection, reel.label, mode.id).then(
      (id) => {
        setJobId(id);
      },
      (error: Error) => {
        setStartError(error.message);
      },
    );
  };

  /** Open one video from anywhere, once the dialog has given us its path. */
  const browse = async (): Promise<void> => {
    if (connection === null) return;
    const picked = pickVideoFile(videoNote.folder ?? '');
    if (picked === null) return;
    try {
      const opened = await openVideo(connection, picked);
      setReels((prev) =>
        prev.some((r) => r.videoPath === opened.videoPath) ? prev : [...prev, opened],
      );
      setReelLabel(opened.label);
      setVideoNote((n) => ({ ...n, trouble: null }));
    } catch (error) {
      setVideoNote((n) => ({ ...n, trouble: (error as Error).message }));
    }
  };

  const buildStep = plan?.steps.find((x) => x.id === 'build') ?? null;
  /*
   * A service running older code than this bundle is the normal way things
   * break here, and until now nothing could see it: both versions on the health
   * payload come from the service, so they agree by construction.
   */
  const dialog = fileDialogSupport();
  const stale = stalenessOf(
    panelBuiltAt(),
    service.kind === 'healthy' ? service.health.process?.startedAt : undefined,
  );

  if (newClient !== null) {
    return (
      <div className="app">
        <Brand logoSrc={logoSrc} service={service} />
        <NewClient
          connection={connection}
          kind={newClient}
          onCancel={() => setNewClient(null)}
          onSaved={(id, next) => {
            setModes(next);
            setModeId(id);
            setNewClient(null);
          }}
        />
      </div>
    );
  }

  if (editor !== null) {
    return (
      <div className="app">
        <Brand logoSrc={logoSrc} service={service} />
        <Editor id={editor} onClose={() => setEditor(null)}>
          {editorContent(editor, connection, reel?.label ?? null)}
        </Editor>
      </div>
    );
  }

  return (
    <div className="app">
      <Brand logoSrc={logoSrc} service={service} />

      <main>
        <Readiness
          state={service}
          attempt={attempt}
          attemptedAt={attemptedAt}
          onRetry={onRedetect}
          resolvedNode={host.resolveNode()}
          stale={stale.detail}
          fileDialog={dialog.detail}
        />

        {/*
         * Client first: it is what decides which videos there are to choose
         * from, so asking for the video first asked a question out of order.
         */}
        <section className="client">
          <h2>Client</h2>
          <label className="field">
            <select
              aria-label="Client"
              value={modeId}
              onChange={(e) => {
                const picked = e.target.value;
                if (picked === '__new') {
                  setNewClient('permanent');
                  return;
                }
                if (picked === '__once') {
                  setNewClient('one-off');
                  return;
                }
                setModeId(picked);
              }}
            >
              <option value="">
                {modes.length === 0 ? 'No clients set up yet' : 'Choose a client…'}
              </option>
              {modes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
              <option value="__new">Set up a new client…</option>
              <option value="__once">Just this video…</option>
            </select>
          </label>
          {mode === null ? null : <ClientCard client={mode} />}
        </section>

        <section className="video">
          <h2>Video</h2>
          <label className="field">
            <select
              aria-label="Video"
              value={reelLabel}
              disabled={reels.length === 0}
              onChange={(e) => setReelLabel(e.target.value)}
            >
              <option value="">{reels.length === 0 ? 'No videos found' : 'Choose a video…'}</option>
              {reels.map((r) => (
                <option key={r.label} value={r.label}>
                  {r.label}
                  {r.durationS === null ? '' : ` — ${r.durationS.toFixed(1)}s`}
                </option>
              ))}
            </select>
          </label>

          <div className="videoactions">
            <button className="ghost" type="button" onClick={() => void loadVideos()}>
              Refresh
            </button>
            {/*
             * Session 44 established that this host has CEP's own dialog, so
             * the path field it used to sit beside is gone: it was the fallback
             * for a case that does not arise here, and a control nobody presses
             * is clutter.
             *
             * The fallback itself is kept, because Block 10's second machine may
             * be a host without one — but as a sentence he can act on rather
             * than a field, and only when the dialog is genuinely absent.
             */}
            {dialog.available ? (
              <button className="ghost" type="button" onClick={() => void browse()}>
                Browse…
              </button>
            ) : null}
          </div>
          {dialog.available ? null : (
            <p className="say" role="status">
              This copy of After Effects offers no file dialog, so videos can only come from a
              client’s folder. Set the folder on the client, or put the video in one that is
              already set.
            </p>
          )}

          {videoNote.folder === null ? null : (
            <p className="faint">From {videoNote.folder}</p>
          )}
          {videoNote.trouble === null ? null : (
            <p className="say" role="status">
              {videoNote.trouble}
            </p>
          )}
          {videoNote.skipped.length === 0 ? null : (
            <ul className="issues">
              {videoNote.skipped.map((f) => (
                <li key={f.name}>
                  {f.name} — {f.why}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* The only thing on this screen he cannot undo, so it stays prominent. */}
        <section className="cost">
          <h2>Cost</h2>
          {reel === null ? null : <Spend reel={reel} />}
          {dry === null ? null : <DryRun plan={dry} />}
          {dryError === null ? null : (
            <p className="say" role="status">
              {dryError}
            </p>
          )}
        </section>

        <section className="do">
          <button className="run" type="button" disabled={!gate.enabled} onClick={onRun}>
            {running ? 'Running…' : 'Run pipeline'}
          </button>
          {gate.reason === null ? null : (
            <p className="say" role="status">
              {gate.reason}
            </p>
          )}
          {startError === null ? null : (
            <p className="say" role="status">
              {startError}
            </p>
          )}
          {job === null ? null : <RunProgress job={job} />}

          {mode === null ? null : <FontsNote mode={mode} />}
          {dry === null || dry.planPath === null ? null : (
            <WatermarkToggle
              enabled={dry.watermark}
              size={dry.watermarkSize}
              widthsPx={dry.watermarkWidthsPx}
              onChange={async (enabled) => {
                if (connection === null || dry.planPath === null) return;
                await setWatermark(connection, { planPath: dry.planPath, enabled });
                setDry({ ...dry, watermark: enabled });
              }}
              onResize={async (size) => {
                if (connection === null || dry.planPath === null) return;
                await setWatermark(connection, { planPath: dry.planPath, size });
                setDry({ ...dry, watermarkSize: size });
              }}
            />
          )}
          <Build
            connection={connection}
            preview={plan?.build}
            ready={reel !== null && mode !== null}
            stale={stale.detail}
            disabled={buildStep?.available !== true}
            disabledReason={buildStep?.reason ?? null}
            issues={buildStep?.issues ?? []}
          />
        </section>

        {/*
         * How he actually works: press Run, press Build, watch it, then come
         * back and change the one thing that bothered him. These are that
         * third move, and nothing more.
         */}
        <section className="change">
          <h2>Change something first</h2>
          <div className="three">
            {EDITORS.map((e) => {
              const step = plan?.steps.find((x) => x.id === e.step) ?? null;
              const count = countFor(e.id, plan);
              return (
                <button
                  key={e.id}
                  type="button"
                  className="opener"
                  disabled={step?.available !== true}
                  title={step?.reason ?? undefined}
                  onClick={() => setEditor(e.id)}
                >
                  <span className="what">{e.label}</span>
                  <span className="count">{count === null ? '—' : count}</span>
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

export type EditorId = 'words' | 'emphasis' | 'pictures';

const EDITORS: { id: EditorId; label: string; step: StepId }[] = [
  { id: 'words', label: 'Words', step: 'transcript' },
  { id: 'emphasis', label: 'Emphasis', step: 'keywords' },
  { id: 'pictures', label: 'Pictures', step: 'images' },
];

/**
 * The number on each opener, read from the build preview rather than parsed out
 * of a sentence. Absent when the service has not sent one, which is not the
 * same as zero.
 */
export function countFor(id: EditorId, plan: PlanSteps | null): number | null {
  const preview = plan?.build;
  if (preview === undefined) return null;
  if (id === 'words') return preview.subtitleCards;
  if (id === 'emphasis') return preview.keywords;
  return preview.images;
}

function Brand({
  logoSrc,
  service,
}: {
  logoSrc: string | null;
  service: ServiceState;
}): JSX.Element {
  return (
    <header className="brand">
      {logoSrc === null ? <div className="mark" aria-hidden="true" /> : <img src={logoSrc} alt="" />}
      <div className="name">
        Framopia <em>Studio</em>
      </div>
      {service.kind === 'healthy' ? (
        <div className="version">v{service.health.appVersion}</div>
      ) : null}
    </header>
  );
}

const EDITOR_TITLE: Record<EditorId, string> = {
  words: 'Words',
  emphasis: 'Emphasis',
  pictures: 'Pictures',
};

/** An editor opened over the main screen, with the way back always in reach. */
function Editor({
  id,
  onClose,
  children,
}: {
  id: EditorId;
  onClose: () => void;
  children: JSX.Element | null;
}): JSX.Element {
  return (
    <main className="editor">
      <div className="editorhead">
        <button className="back" type="button" onClick={onClose}>
          Back
        </button>
        <h2>{EDITOR_TITLE[id]}</h2>
      </div>
      {children}
    </main>
  );
}

function editorContent(
  id: EditorId,
  connection: Connection | null,
  reel: string | null,
): JSX.Element | null {
  if (id === 'words') return <Transcript connection={connection} reel={reel} />;
  if (id === 'emphasis') return <Keywords connection={connection} reel={reel} />;
  return <Images connection={connection} reel={reel} />;
}

/**
 * The panel with no host. It is a screen, not an error dialog: the brand
 * header stays, the cause is the service-error treatment every other failure
 * gets, and it says what the missing capability prevents rather than only what
 * is absent — "cep_node is not available" means nothing to a motion designer
 * standing in front of a blank panel.
 */
function HostUnavailable({
  env,
  attempt,
  attemptedAt,
  onRetry,
}: {
  env: Extract<HostEnvironment, { available: false }>;
  attempt: number;
  attemptedAt: string;
  onRetry: () => void;
}): JSX.Element {
  return (
    <div className="app">
      <header className="brand">
        <div className="mark" aria-hidden="true" />
        <div className="name">
          Framopia <em>Studio</em>
        </div>
      </header>
      <main>
        <section>
          <h2>Host</h2>
          <div className="card">
            <Attempt attempt={attempt} attemptedAt={attemptedAt} />
            <div className="status">
              <div className="dot unreachable" />
              <div>
                <div className="headline">After Effects is not providing {env.missing}</div>
                <div className="detail">{env.cause}</div>
              </div>
            </div>
            <ul className="facts">
              <li>
                <span className="k">missing</span>
                <span className="v bad">{env.missing}</span>
              </li>
              <li>
                <span className="k">prevents</span>
                <span className="v">{env.prevents}</span>
              </li>
            </ul>
            <button className="retry" type="button" onClick={onRetry}>
              Retry
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

/**
 * What the build will set the type in.
 *
 * It sits at Build and not at Run because fonts decide how the comp is drawn,
 * not whether speech can be transcribed, analysed or imaged — and
 * PROJECT_SPEC §5 reserves a client's own fonts for Block 9, which comes after
 * this block. Gating Run on them made Block 8's definition of done
 * unreachable.
 */
/**
 * Whether this reel is delivered with the intro watermark.
 *
 * Per reel, and on the plan, because some of this agency's deliveries carry the
 * mark and some do not. Until this existed the builder placed one whenever the
 * asset was on disk, which is the same answer for every reel — the user found
 * a mark on a reel whose plan recorded nothing about it.
 */
function WatermarkToggle({
  enabled,
  size,
  widthsPx,
  onChange,
  onResize,
}: {
  enabled: boolean;
  size: WatermarkSize | undefined;
  widthsPx: Record<WatermarkSize, number> | undefined;
  onChange: (enabled: boolean) => void | Promise<void>;
  onResize: (size: WatermarkSize) => void | Promise<void>;
}): JSX.Element {
  return (
    <div className="watermark">
      <label>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => void onChange(event.target.checked)}
        />
        <span>Watermark this reel</span>
      </label>
      {/*
        A service older than the size choice sends nothing, and nothing is not a
        preference — the buttons stay away rather than show a guess the user
        could press and have ignored.
      */}
      {!enabled || size === undefined ? null : (
        <div className="sizes" role="group" aria-label="Watermark size">
          {WATERMARK_SIZE_LABELS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={value === size ? 'chosen' : ''}
              aria-pressed={value === size}
              onClick={() => void onResize(value)}
            >
              {label}
              {widthsPx === undefined ? '' : ` · ${widthsPx[value]} px`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const WATERMARK_SIZE_LABELS: [WatermarkSize, string][] = [
  ['small', 'Small'],
  ['medium', 'Medium'],
  ['large', 'Large'],
];

function FontsNote({ mode }: { mode: ClientMode }): JSX.Element | null {
  const fonts = buildFonts({
    name: mode.name,
    fonts: mode.fonts === undefined ? { status: 'tbd' } : { status: 'set', ...mode.fonts },
  });
  if (fonts.warning === null) return null;
  return (
    <div className="card note" style={{ marginBottom: 12 }} role="status">
      <div className="detail">{fonts.warning}</div>
    </div>
  );
}

/**
 * What a stage would do, in the user's words rather than the resolver's.
 *
 * It reads `provenance`, never `status`: `status` is what the plan remembers
 * and `provenance` is what the cache answers now. The panel said "cached" from
 * `status` for four blocks while a run would have re-transcribed and billed.
 */
/**
 * What the cost block says a stage will do.
 *
 * It reads `action`, which the service computes, and **not** `provenance` and
 * `estimateUsd`, which it used to infer from. Those two cannot express "the
 * plan already has this, so a run skips it": `vitasilk`'s analysis has a cache
 * miss and no estimate, and the old inference turned that into "to run" while
 * the run beneath reported "skipped — already on the plan". Six tests pinned
 * the two service functions against each other and none of them looked at this
 * string.
 */
function stageWord(stage: DryRunStage): string {
  if (stage.action === 'skip') return 'already done';
  if (stage.provenance === 'compatible') return 'free, reusing an earlier run';
  if (stage.action === 'reuse') return 'free, already paid for';
  return stage.estimateUsd === null ? 'will run' : `will run, about $${stage.estimateUsd.toFixed(2)}`;
}

function stageTone(stage: DryRunStage): string {
  if (stage.action === 'skip') return 'warn';
  if (stage.provenance === 'exact') return 'good';
  if (stage.provenance === 'compatible') return 'warn';
  return '';
}

/**
 * What a run would do, read before anything is spent. Every figure comes from
 * the service, which resolves each stage against the cache on disk — the panel
 * computes none of them.
 */
function DryRun({ plan }: { plan: DryRunPlan }): JSX.Element {
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      {/* Above the stage list, not in it: the client is not a stage, and the
          cost block's rows are read as stages by everything that scrapes them.
          Nullish rather than null — a service that has not been rebuilt sends
          no such field, and the panel renders rather than throws. */}
      <p className="spend note" style={{ marginTop: 0 }}>
        {plan.planClientMode == null
          ? 'No client saved for this video yet. Run the pipeline and it is saved for you.'
          : `Made for ${plan.planClientMode.id}.`}
      </p>
      <ul className="facts">
        {plan.stages.map((stage) => (
          <li key={stage.id}>
            <span className="k">{stage.label}</span>
            <span className={`v ${stageTone(stage)}`} title={stage.note}>
              {stageWord(stage)}
            </span>
          </li>
        ))}
      </ul>
      <div className="spend" style={{ marginTop: 12 }}>
        <div>
          <div className={`amount ${plan.estimateUsd >= SPEND_SOFT_ALARM_USD ? 'alarm' : ''}`}>
            {plan.estimateUsd === 0 ? 'nothing to pay' : `about $${plan.estimateUsd.toFixed(2)}`}
          </div>
          <div className="cap">
            {plan.estimateUsd === 0
              ? 'everything this video needs has already been paid for'
              : 'the most it could cost, not what it will'}
          </div>
        </div>
      </div>
      {plan.reusesOlderGuide ? (
        <p className="note">
          Reusing the words from an earlier run. Nothing is re-transcribed and nothing is
          charged.
        </p>
      ) : null}
    </div>
  );
}

function Spend({ reel }: { reel: Reel }): JSX.Element {
  const level = spendLevel(reel.spentUsd);
  return (
    <div style={{ marginTop: 14 }}>
      <div className="spend">
        <div>
          <div className={`amount ${level === 'alarm' ? 'alarm' : ''}`}>{formatUsd(reel.spentUsd)}</div>
          <div className="cap">spent on this video so far</div>
        </div>
        <div className="cap">soft alarm ${SPEND_SOFT_ALARM_USD.toFixed(2)}</div>
      </div>
      {level === 'alarm' ? (
        <p className="reason">This reel is past the expected envelope for a finished reel.</p>
      ) : null}
      {reel.planPath === null ? <p className="spend note">No edit plan yet.</p> : null}
    </div>
  );
}

/**
 * Every attempt renders differently, even when it fails identically.
 *
 * Two consecutive failures used to produce byte-identical text, so a working
 * Retry was indistinguishable from a dead one. The user pressed it after
 * building the service and could not tell whether anything had happened.
 */
/**
 * The run, stage by stage, in the same words and the same order the dry run
 * used — they are two views of one thing, and the stage list is declared once
 * in the service.
 *
 * A failed stage shows the cause **as it came**, per ARCHITECTURE §8. The panel
 * does not summarise it: a paraphrase of "the model returned 503" is worth less
 * than the sentence, and the panel is not where a diagnosis is made.
 */
function RunProgress({ job }: { job: PipelineJob }): JSX.Element {
  const detail = job.detail;
  if (detail === undefined) {
    return (
      <p className="reason" role="status">
        Starting the run…
      </p>
    );
  }
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <ul className="facts">
        {detail.stages.map((stage) => (
          <li key={stage.id}>
            <span className="k">{stage.label}</span>
            <span className={`v ${stageToneOf(stage.state)}`} title={stage.reason ?? stage.label}>
              {stageWordOf(stage)}
              {stage.reason === null ? null : <em className="where">{stage.reason}</em>}
            </span>
          </li>
        ))}
      </ul>
      {detail.error === null ? null : (
        <p className="reason" role="status">
          {detail.error.cause}
          {detail.error.retryable ? ' It is worth trying again.' : ''}
        </p>
      )}
      <div className="spend" style={{ marginTop: 12 }}>
        <div>
          <div
            className={`amount ${
              (detail.planSpentUsd ?? 0) >= SPEND_SOFT_ALARM_USD ? 'alarm' : ''
            }`}
          >
            {formatUsd(detail.spentUsd)}
          </div>
          <div className="cap">
            billed by this run
            {detail.planSpentUsd === null
              ? ''
              : ` · ${formatUsd(detail.planSpentUsd)} on this video in total`}
          </div>
        </div>
      </div>
    </div>
  );
}

function stageWordOf(stage: PipelineStageReport): string {
  if (stage.state === 'done') return stage.costUsd > 0 ? `done, ${formatUsd(stage.costUsd)}` : 'done';
  if (stage.state === 'skipped') return 'skipped';
  if (stage.state === 'failed') return 'failed';
  if (stage.state === 'running') return 'running…';
  return 'waiting';
}

function stageToneOf(state: PipelineStageReport['state']): string {
  if (state === 'done') return 'good';
  if (state === 'failed') return 'bad';
  if (state === 'skipped') return 'warn';
  return '';
}


function Attempt({ attempt, attemptedAt }: { attempt: number; attemptedAt: string }): JSX.Element {
  return (
    <div className="attempt" data-attempt={attempt}>
      {attempt === 0 ? 'first check' : `attempt ${attempt + 1}`} at {attemptedAt}
    </div>
  );
}

