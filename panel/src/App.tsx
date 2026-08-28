import { useCallback, useEffect, useRef, useState } from 'react';
import { buildFonts } from '@framopia/core/build-fonts';
import {
  connect,
  fetchDryRun,
  fetchModes,
  fetchReels,
  fetchSteps,
  type Connection,
} from './service.js';
import { nodeMatch } from './node-match.js';
import { isWide, observeWidth } from './panel-width.js';
import {
  reconcileStep,
  stepViews,
  STEP_ORDER,
  STEP_PROMISE,
  type StepView,
} from './steps.js';

/** How often to notice a service that has gone away. Chosen, not measured. */
const HEARTBEAT_MS = 5000;
import { runGate } from './run-gate.js';
import { formatUsd, SPEND_SOFT_ALARM_USD, spendLevel } from './spend.js';
import type {
  ClientMode,
  DryRunPlan,
  DryRunStage,
  HostEnvironment,
  PlanSteps,
  Reel,
  ServiceState,
  StepId,
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
  const shell = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(false);

  /*
   * The two-column switch. A class toggled from a measured width, not a
   * container query: CEP runs Chromium 99 and container queries shipped in 105,
   * so the query was dead text and the panel stayed one column at 1572 px.
   */
  useEffect(() => {
    const element = shell.current;
    if (element === null) return;
    return observeWidth(element, (width) => setWide(isWide(width)));
  }, []);
  const [service, setService] = useState<ServiceState>({ kind: 'starting' });
  const [reels, setReels] = useState<Reel[]>([]);
  const [modes, setModes] = useState<ClientMode[]>([]);
  const [reelLabel, setReelLabel] = useState<string>('');
  const [modeId, setModeId] = useState<string>('');
  const [connection, setConnection] = useState<Connection | null>(null);
  const [dry, setDry] = useState<DryRunPlan | null>(null);
  const [dryError, setDryError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanSteps | null>(null);
  const [step, setStep] = useState<StepId>('reel');
  /*
   * Whether the user has navigated. Until they have, the panel follows the
   * plan and opens where the reel actually is; after they have, their choice
   * stands unless the plan stops supporting it.
   */
  const [touched, setTouched] = useState(false);

  const check = useCallback(async () => {
    setService({ kind: 'starting' });
    const result = await connect(host);
    if (!result.ok) {
      setService({ kind: 'unreachable', error: result.error });
      setConnection(null);
      return;
    }
    setService({ kind: 'healthy', health: result.health });
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
    void fetchReels(connection).then(setReels, () => setReels([]));
    void fetchModes(connection).then(setModes, () => setModes([]));
  }, [connection]);

  const reel = reels.find((r) => r.label === reelLabel) ?? null;
  const mode = modes.find((m) => m.id === modeId) ?? null;
  const gate = runGate({ service, reel, mode });

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

  useEffect(() => {
    setStep((current) => reconcileStep(plan, current, touched));
  }, [plan, touched]);

  /* A different reel is a different job: its progress is not this one's. */
  useEffect(() => {
    setTouched(false);
  }, [reelLabel, modeId]);

  const views = stepViews(plan, step);
  const goTo = (id: StepId): void => {
    setTouched(true);
    setStep(id);
  };

  return (
    <div className={wide ? 'app wide' : 'app'} ref={shell}>
      <header className="brand">
        {logoSrc === null ? <div className="mark" aria-hidden="true" /> : <img src={logoSrc} alt="" />}
        <div className="name">
          Framopia <em>Studio</em>
        </div>
        {service.kind === 'healthy' ? (
          <div className="version">v{service.health.appVersion}</div>
        ) : null}
      </header>

      <StepRail views={views} onGo={goTo} />

      {step === 'reel' ? (
      <main>
        <ServiceCard
          state={service}
          attempt={attempt}
          attemptedAt={attemptedAt}
          onRetry={onRedetect}
          resolvedNode={host.resolveNode()}
        />

        <section className="video">
          <h2>Video</h2>
          <div className="card">
            <label className="field">
              <span>Reel</span>
              <select
                aria-label="Reel"
                value={reelLabel}
                disabled={reels.length === 0}
                onChange={(e) => setReelLabel(e.target.value)}
              >
                <option value="">
                  {reels.length === 0 ? 'No reels found on this machine' : 'Select a video…'}
                </option>
                {reels.map((r) => (
                  <option key={r.label} value={r.label}>
                    {r.label}
                    {r.durationS === null ? '' : ` — ${r.durationS.toFixed(1)}s`}
                  </option>
                ))}
              </select>
            </label>
            {reel === null ? null : <Spend reel={reel} />}
          </div>
        </section>

        <section className="mode">
          <h2>Client mode</h2>
          <div className="card">
            <label className="field">
              <span>Mode</span>
              <select
                aria-label="Client mode"
                value={modeId}
                disabled={modes.length === 0}
                onChange={(e) => setModeId(e.target.value)}
              >
                <option value="">
                  {modes.length === 0 ? 'No modes in modes/' : 'Select a client…'}
                </option>
                {modes.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — v{m.version}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="build">
          <h2>Build</h2>
          {mode === null ? null : <FontsNote mode={mode} />}
          {dry === null ? null : <DryRun plan={dry} />}
          {dryError === null ? null : (
            <p className="reason" role="status">
              {dryError}
            </p>
          )}
          <button className="run" type="button" disabled={!gate.enabled}>
            Run pipeline
          </button>
          {gate.reason === null ? null : (
            <p className="reason" role="status">
              {gate.reason}
            </p>
          )}
        </section>
      </main>
      ) : (
        <StepPane
          view={views.find((v) => v.id === step) as StepView}
          onBack={() => goTo(previousStep(step))}
        />
      )}
    </div>
  );
}

/**
 * The rail. Five entries always, so the shape of the job is visible on an
 * empty panel; a step the plan does not support is not a button, and its
 * reason is on the element rather than hidden behind a hover only a mouse can
 * reach.
 *
 * The current marker is deliberately **not** brand red. PROJECT_SPEC §6 spends
 * `#ED1C24` on one thing, and the user ruled that thing is Run pipeline.
 */
function StepRail({
  views,
  onGo,
}: {
  views: StepView[];
  onGo: (id: StepId) => void;
}): JSX.Element {
  return (
    <nav className="rail" aria-label="Pipeline steps">
      <ol>
        {views.map((view, i) => {
          const classes = ['step'];
          if (view.current) classes.push('current');
          if (!view.available) classes.push('locked');
          return (
            <li key={view.id} className={classes.join(' ')}>
              <button
                type="button"
                disabled={!view.available}
                aria-current={view.current ? 'step' : undefined}
                title={view.available ? (view.summary ?? view.label) : (view.reason ?? view.label)}
                onClick={() => onGo(view.id)}
              >
                <span className="n">{i + 1}</span>
                <span className="l">{view.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function previousStep(step: StepId): StepId {
  const i = STEP_ORDER.indexOf(step);
  return STEP_ORDER[Math.max(0, i - 1)] as StepId;
}

/**
 * A step that is not built yet. It says what will live there and shows the
 * real figures the plan already carries — never a mock of the screen to come,
 * which would read as a feature that exists and does nothing.
 */
function StepPane({ view, onBack }: { view: StepView; onBack: () => void }): JSX.Element {
  return (
    <main>
      <section>
        <h2>{view.label}</h2>
        <div className="card">
          <p className="promise">{STEP_PROMISE[view.id]}</p>
          {view.summary === null ? null : (
            <p className="detail" role="status">
              {view.summary}
            </p>
          )}
          {view.reason === null ? null : (
            <p className="reason" role="status">
              {view.reason}
            </p>
          )}
          <p className="note">This step is not built yet.</p>
        </div>
        <button className="back" type="button" onClick={onBack}>
          Back
        </button>
      </section>
    </main>
  );
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
function stageWord(stage: DryRunStage): string {
  if (stage.provenance === 'exact') return 'cached';
  if (stage.provenance === 'compatible') return 'cached, older guide';
  if (stage.provenance === null) return stage.status === 'done' ? 'done' : 'to run';
  return stage.estimateUsd === null ? 'to run' : `to run, about $${stage.estimateUsd.toFixed(2)}`;
}

function stageTone(stage: DryRunStage): string {
  if (stage.provenance === 'exact') return 'good';
  if (stage.provenance === 'compatible') return 'warn';
  return '';
}

/**
 * The dry run: what a run would do, read before anything is spent. Every
 * figure comes from the service, which resolves each stage against the cache
 * on disk — the panel computes none of them.
 */
function DryRun({ plan }: { plan: DryRunPlan }): JSX.Element {
  return (
    <div className="card" style={{ marginBottom: 12 }}>
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
              ? 'every stage is cached; a run would read from disk'
              : 'budgeted ceiling for the stages that would call the API, not a forecast'}
          </div>
        </div>
      </div>
      {plan.reusesOlderGuide ? (
        <p className="note">
          Reusing a transcription made against an older orthography guide. It will not
          re-transcribe and will not bill.
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
          <div className="cap">spent on this reel so far</div>
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

function ServiceCard({
  state,
  attempt,
  attemptedAt,
  onRetry,
  resolvedNode,
}: {
  state: ServiceState;
  attempt: number;
  attemptedAt: string;
  onRetry: () => void;
  resolvedNode: { path: string } | null;
}): JSX.Element {
  const mismatch =
    state.kind === 'healthy' ? nodeMatch(state.health, resolvedNode).warning : null;
  return (
    <section className="service">
      <h2>Service</h2>
      <div className="card">
        <Attempt attempt={attempt} attemptedAt={attemptedAt} />
        {state.kind === 'starting' ? (
          <div className="status">
            <div className="dot starting" />
            <div>
              <div className="headline">Starting…</div>
              <div className="detail">Looking for the companion service on this machine.</div>
            </div>
          </div>
        ) : null}

        {state.kind === 'unreachable' ? (
          <>
            <div className="status">
              <div className="dot unreachable" />
              <div>
                <div className="headline">Not reachable</div>
                {/* ARCHITECTURE §8: the cause is shown as the service worded it. */}
                <div className="detail">{state.error.cause}</div>
              </div>
            </div>
            <ul className="facts">
              <li>
                <span className="k">stage</span>
                <span className="v">{state.error.stage}</span>
              </li>
              <li>
                <span className="k">retryable</span>
                <span className={`v ${state.error.retryable ? 'good' : 'bad'}`}>
                  {state.error.retryable ? 'yes' : 'no'}
                </span>
              </li>
            </ul>
            <button className="retry" type="button" onClick={onRetry}>
              Retry
            </button>
          </>
        ) : null}

        {state.kind === 'healthy' ? (
          <>
            <div className="status">
              <div className={`dot ${state.health.ok ? 'healthy' : 'unreachable'}`} />
              <div>
                <div className="headline">{state.health.ok ? 'Ready' : 'Running, with problems'}</div>
                <div className="detail">
                  Service {state.health.serviceVersion} · correction prompt v{state.health.promptVersion}
                </div>
              </div>
            </div>
            <ul className="facts">
              <Fact label="ffmpeg" tool={state.health.ffmpeg} />
              <Fact label="ffprobe" tool={state.health.ffprobe} />
              <Fact label="CV sidecar" tool={state.health.sidecar.venv} />
              <li>
                <span className="k">node</span>
                {/* Optional so an older service cannot blank the panel. */}
                <span className={`v ${state.health.node?.path == null ? 'bad' : ''}`}>
                  {state.health.node?.path == null
                    ? 'not reported'
                    : `${state.health.node.path} (${state.health.node.source})`}
                </span>
              </li>
              <li>
                <span className="k">templates</span>
                <span className={`v ${state.health.templates.valid ? 'good' : 'bad'}`}>
                  {state.health.templates.valid
                    ? `${state.health.templates.count} valid`
                    : `${state.health.templates.issues.length} problem(s)`}
                </span>
              </li>
            </ul>
            {mismatch === null ? null : (
              <p className="reason" role="status">
                {mismatch}
              </p>
            )}
            {state.health.templates.issues.length > 0 ? (
              <ul className="issues">
                {state.health.templates.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            ) : null}
            <button className="retry" type="button" onClick={onRetry}>
              Re-check
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Every attempt renders differently, even when it fails identically.
 *
 * Two consecutive failures used to produce byte-identical text, so a working
 * Retry was indistinguishable from a dead one. The user pressed it after
 * building the service and could not tell whether anything had happened.
 */
function Attempt({ attempt, attemptedAt }: { attempt: number; attemptedAt: string }): JSX.Element {
  return (
    <div className="attempt" data-attempt={attempt}>
      {attempt === 0 ? 'first check' : `attempt ${attempt + 1}`} at {attemptedAt}
    </div>
  );
}

function Fact({ label, tool }: { label: string; tool: { present: boolean; detail: string } }): JSX.Element {
  return (
    <li>
      <span className="k">{label}</span>
      <span className={`v ${tool.present ? 'good' : 'bad'}`} title={tool.detail}>
        {tool.present ? tool.detail : 'missing'}
      </span>
    </li>
  );
}
