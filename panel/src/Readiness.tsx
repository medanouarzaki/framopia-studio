import { useState } from 'react';
import { describeBuildStamps, panelBuildStamp } from './staleness.js';
import { nodeMatch } from './node-match.js';
import type { ServiceState, ToolState } from './types.js';

/**
 * Whether the tool can work, in one line.
 *
 * It used to be a card of eight facts — two ffmpeg versions with their paths, a
 * Python version, a Node path, a template count, a pid, a start time — on
 * screen at every glance. **None of them changes what he does next while
 * everything is working**, and he is a motion designer, not the person who
 * installed ffmpeg. So the line says Ready and the facts move behind Details.
 *
 * **When something is wrong it comes forward.** A missing tool, a template
 * problem or a Node mismatch is on the main screen with what to do about it,
 * because then it is the only thing that matters.
 */
export function Readiness({
  state,
  attempt,
  attemptedAt,
  onRetry,
  resolvedNode,
  stale,
  fileDialog,
}: {
  state: ServiceState;
  attempt: number;
  attemptedAt: string;
  onRetry: () => void;
  resolvedNode: { path: string } | null;
  /** Set when the service is running older code than this panel. */
  stale: string | null;
  /** Whether this host offers a file dialog, in one line. */
  fileDialog: string;
}): JSX.Element {
  const [open, setOpen] = useState(false);

  if (state.kind === 'starting') {
    return (
      <section className="readiness">
        <p className="line">
          <span className="dot starting" />
          <span className="word">Starting…</span>
        </p>
      </section>
    );
  }

  if (state.kind === 'unreachable') {
    return (
      <section className="readiness bad">
        <p className="line">
          <span className="dot unreachable" />
          <span className="word">Not working</span>
        </p>
        <p className="say">{state.error.cause}</p>
        {state.error.retryable ? <p className="say">This usually clears on its own.</p> : null}
        <button className="ghost" type="button" onClick={onRetry}>
          Try again
        </button>
        <p className="faint attempt" data-attempt={attempt}>
          {attempt === 0 ? 'first check' : `attempt ${attempt + 1}`} at {attemptedAt}
        </p>
      </section>
    );
  }

  const health = state.health;
  const trouble: string[] = [];
  if (!health.ffmpeg.present) trouble.push('ffmpeg is not installed, so no video can be read.');
  if (!health.ffprobe.present) trouble.push('ffprobe is not installed, so no video can be read.');
  if (!health.sidecar.venv.present) {
    trouble.push('The picture tools are not set up, so pictures cannot be placed. Run tools/cv/setup.sh.');
  }
  if (!health.templates.valid) {
    trouble.push(`The template library has ${health.templates.issues.length} problem(s).`);
  }
  const mismatch = nodeMatch(health, resolvedNode).warning;
  if (mismatch !== null) trouble.push(mismatch);
  // A service behind the panel is not broken, but it is why a control can look
  // like it is lying, so it belongs where a real problem goes.
  if (stale !== null) trouble.push(stale);

  return (
    <section className={trouble.length === 0 ? 'readiness' : 'readiness warn'}>
      <p className="line">
        <span className={`dot ${trouble.length === 0 ? 'healthy' : 'unreachable'}`} />
        <span className="word">{trouble.length === 0 ? 'Ready' : 'Ready, with problems'}</span>
        <button className="link" type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Hide details' : 'Details'}
        </button>
      </p>

      {trouble.map((line) => (
        <p className="say" key={line}>
          {line}
        </p>
      ))}
      {health.templates.issues.length > 0 ? (
        <ul className="issues">
          {health.templates.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}

      {open ? (
        <div className="details">
          <ul className="facts">
            <Fact label="ffmpeg" tool={health.ffmpeg} />
            <Fact label="ffprobe" tool={health.ffprobe} />
            <Fact label="picture tools" tool={health.sidecar.venv} />
            <li>
              <span className="k">node</span>
              {/* Optional so an older service cannot blank the panel. */}
              <span className={`v ${health.node?.path == null ? 'bad' : ''}`}>
                {health.node?.path == null
                  ? 'not reported'
                  : `${health.node.path} (${health.node.source})`}
              </span>
            </li>
            <li>
              <span className="k">templates</span>
              <span className={`v ${health.templates.valid ? 'good' : 'bad'}`}>
                {health.templates.valid
                  ? `${health.templates.count} ready`
                  : `${health.templates.issues.length} problem(s)`}
              </span>
            </li>
          </ul>
          {/*
            Which process answered. A service started in a terminal inherits a
            shell PATH and one this panel spawned does not, so the two can
            disagree about what the machine has — and did, over ffmpeg,
            invisibly, for a whole session.
          */}
          <p className="faint">{originLine(state)}</p>
          <p className="faint">Version {health.serviceVersion}</p>
          {/*
            Said out loud even when it agrees. The main screen stays quiet on a
            match, so without this line "I cannot tell" and "they agree" would
            look identical — and they are different answers.
          */}
          <p className="faint">{describeBuildStamps(panelBuildStamp(), health.buildStamp)}</p>
          {/* Reported whichever way it went, so he can tell me what his host has. */}
          <p className="faint">{fileDialog}</p>
          <p className="faint attempt" data-attempt={attempt}>
            {attempt === 0 ? 'first check' : `attempt ${attempt + 1}`} at {attemptedAt}
          </p>
          <button className="ghost" type="button" onClick={onRetry}>
            Check again
          </button>
        </div>
      ) : null}
    </section>
  );
}

export function originLine(state: Extract<ServiceState, { kind: 'healthy' }>): string {
  const started = state.origin === 'spawned' ? 'Started by the panel' : 'Was already running';
  const process = state.health.process;
  if (process === undefined) return `${started} · pid unknown`;
  const when = new Date(process.startedAt);
  const at = Number.isNaN(when.getTime()) ? process.startedAt : when.toLocaleTimeString();
  return `${started} · pid ${process.pid} · since ${at}`;
}

/**
 * A tool's state, and **which binary answered**. The panel reported
 * `ffmpeg version 8.0.1` and `missing` eight minutes apart with nothing changed
 * on the machine: the first came from a service started in a terminal, which
 * inherits a shell PATH, and the second from one After Effects spawned, which
 * does not. Showing the path makes that impossible to misread.
 */
function Fact({ label, tool }: { label: string; tool: ToolState }): JSX.Element {
  const where =
    tool.path === undefined
      ? null
      : `${tool.path}${tool.source === undefined ? '' : ` (${tool.source})`}`;
  return (
    <li>
      <span className="k">{label}</span>
      <span className={`v ${tool.present ? 'good' : 'bad'}`} title={tool.detail}>
        {tool.present ? tool.detail : 'missing'}
        {where === null ? null : <em className="where">{where}</em>}
      </span>
    </li>
  );
}
