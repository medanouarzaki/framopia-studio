import { useCallback, useEffect, useState } from 'react';
import { connect, type PanelHost } from './service.js';
import { runGate } from './run-gate.js';
import { formatUsd, SPEND_SOFT_ALARM_USD, spendLevel } from './spend.js';
import type { ClientMode, Reel, ServiceState } from './types.js';

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
  host: PanelHost;
  /** Injected so the screen can be rendered from a fixture without a service. */
  loadReels: () => Promise<Reel[]>;
  loadModes: () => Promise<ClientMode[]>;
  /**
   * null when `assets/brand/Framopia_LOGO.png` is not on disk. PROJECT_SPEC §6
   * names that file and the repo does not carry it yet; a broken image icon
   * would read as a bug, so the wordmark stands alone until the user supplies
   * it.
   */
  logoSrc: string | null;
}

export function App({ host, loadReels, loadModes, logoSrc }: AppProps): JSX.Element {
  const [service, setService] = useState<ServiceState>({ kind: 'starting' });
  const [reels, setReels] = useState<Reel[]>([]);
  const [modes, setModes] = useState<ClientMode[]>([]);
  const [reelLabel, setReelLabel] = useState<string>('');
  const [modeId, setModeId] = useState<string>('');

  const check = useCallback(async () => {
    setService({ kind: 'starting' });
    const result = await connect(host);
    setService(result.ok ? { kind: 'healthy', health: result.health } : { kind: 'unreachable', error: result.error });
  }, [host]);

  useEffect(() => {
    void check();
    void loadReels().then(setReels);
    void loadModes().then(setModes);
  }, [check, loadReels, loadModes]);

  const reel = reels.find((r) => r.label === reelLabel) ?? null;
  const mode = modes.find((m) => m.id === modeId) ?? null;
  const gate = runGate({ service, reel, mode });

  return (
    <div className="app">
      <header className="brand">
        {logoSrc === null ? <div className="mark" aria-hidden="true" /> : <img src={logoSrc} alt="" />}
        <div className="name">
          Framopia <em>Studio</em>
        </div>
        {service.kind === 'healthy' ? (
          <div className="version">v{service.health.appVersion}</div>
        ) : null}
      </header>

      <main>
        <ServiceCard state={service} onRetry={() => void check()} />

        <section>
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

        <section>
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

        <section>
          <h2>Build</h2>
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

function ServiceCard({ state, onRetry }: { state: ServiceState; onRetry: () => void }): JSX.Element {
  return (
    <section>
      <h2>Service</h2>
      <div className="card">
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
                <span className="k">templates</span>
                <span className={`v ${state.health.templates.valid ? 'good' : 'bad'}`}>
                  {state.health.templates.valid
                    ? `${state.health.templates.count} valid`
                    : `${state.health.templates.issues.length} problem(s)`}
                </span>
              </li>
            </ul>
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
