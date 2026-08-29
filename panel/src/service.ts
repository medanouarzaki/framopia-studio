import { NODE_NOT_FOUND_HELP } from '@framopia/core/node-path';
import type {
  ImagesView, WatermarkSize, BuildJob, ClientMode, DryRunPlan, HealthPayload, Reel, ServiceError, PlanSteps , ServiceOrigin , PipelineJob , TranscriptView, TranscriptWordView, TranscriptCardView , KeywordsView } from './types.js';

/**
 * The panel's half of the ARCHITECTURE §1.3 handshake: the service binds
 * 127.0.0.1 on a random free port and writes the port and a shared token to a
 * well-known file, which the panel reads before it can talk to anything.
 *
 * Everything that touches the filesystem or spawns a process goes through the
 * injected `host`. Inside After Effects that is CEP's Node integration; in a
 * test it is a fake. The alternative — importing `node:fs` at the top of a
 * React module — makes the whole screen untestable outside CEP and hides how
 * much of the panel is really host-dependent.
 */
export type SpawnResult =
  | { ok: true; nodePath: string; source: string }
  | { ok: false; cause: string; nodePath?: string };

export interface PanelHost {
  readHandshake(): { port: number; token: string; pid: number } | null;
  /**
   * Starts the service and reports what happened. It resolves only once the
   * process has either failed, exited, or survived long enough to be believed
   * — a spawn that returns is not a service that runs.
   */
  spawnService(): Promise<SpawnResult>;
  processAlive(pid: number): boolean;
  resolveNode(): { path: string; source: string } | null;
}

export const HEALTH_TIMEOUT_MS = 4000;

/** How long to wait for a freshly spawned service to answer. Chosen, not measured. */
export const SERVICE_START_TIMEOUT_MS = 12_000;
const POLL_INTERVAL_MS = 250;

export function serviceErrorOf(stage: string, cause: string, retryable: boolean): ServiceError {
  return { error: cause, stage, cause, retryable };
}

async function getHealth(port: number, signal: AbortSignal): Promise<HealthPayload> {
  const res = await fetch(`http://127.0.0.1:${port}/health`, { signal });
  if (!res.ok) throw new Error(`health returned HTTP ${res.status}`);
  return (await res.json()) as HealthPayload;
}

/**
 * Reads the handshake, checks the service is really there, and starts one if
 * it is not.
 *
 * The pid is what makes starting safe: a handshake file left behind by a
 * service that died with the machine names a process that no longer exists, so
 * it is reclaimed rather than obeyed. Obeying it would leave the panel waiting
 * forever on a service nobody is running — and the opposite mistake, ignoring
 * a live lock, would start a second service on a second port with the first
 * still holding the file.
 */
export async function connect(host: PanelHost): Promise<
  { ok: true; health: HealthPayload; port: number; token: string; origin: ServiceOrigin } | { ok: false; error: ServiceError }
> {
  /*
   * The host reads a file and signals a pid; both can fail for reasons that
   * are not this panel's business — a permissions change, a filesystem
   * unmounting. Neither is worth an unhandled rejection inside an effect, so
   * they become a state like everything else.
   */
  let handshake: ReturnType<PanelHost['readHandshake']>;
  let alive = false;
  try {
    handshake = host.readHandshake();
    alive = handshake !== null && host.processAlive(handshake.pid);
  } catch (error) {
    return {
      ok: false,
      error: serviceErrorOf('service-handshake', (error as Error).message, true),
    };
  }

  if (handshake !== null && alive) {
    try {
      const health = await withTimeout((signal) => getHealth(handshake.port, signal));
      return { ok: true, health, port: handshake.port, token: handshake.token, origin: 'existing' };
    } catch (error) {
      // The pid is alive but nothing answers: a service mid-start, or a pid
      // reused by something else. Either way spawning a second one would make
      // it worse, so this is reported rather than worked around.
      return {
        ok: false,
        error: serviceErrorOf(
          'service-connect',
          `a service is registered on port ${handshake.port} as pid ${handshake.pid} but did not answer: ${(error as Error).message}`,
          true,
        ),
      };
    }
  }

  const node = host.resolveNode();
  if (node === null) {
    return {
      ok: false,
      // The one wording, shared with the service's health payload rather than
      // retyped here, so the two cannot drift.
      error: serviceErrorOf('node-missing', NODE_NOT_FOUND_HELP, false),
    };
  }

  let spawned: SpawnResult;
  try {
    spawned = await host.spawnService();
  } catch (error) {
    return { ok: false, error: serviceErrorOf('service-spawn', (error as Error).message, true) };
  }

  if (!spawned.ok) {
    /*
     * Two panels opening together both find no handshake and both spawn. The
     * second service refuses the first one's lock and exits, so the spawn
     * "fails" while a perfectly good service is now listening. Reporting that
     * as a failure would leave the second panel broken beside a working one.
     */
    const reused = await reachExisting(host);
    if (reused !== null) return reused;

    return {
      ok: false,
      error: serviceErrorOf(
        'service-spawn',
        `the service could not be started using ${spawned.nodePath ?? node.path}: ${spawned.cause}`,
        true,
      ),
    };
  }

  /*
   * ARCHITECTURE §8: nothing may assert a state it has not checked. The panel
   * used to say "one has been started. Retry in a moment." the instant spawn()
   * returned — while the spawn had already failed with ENOENT. A started
   * service is one that answers.
   */
  const deadline = now() + SERVICE_START_TIMEOUT_MS;
  let lastError = 'it did not answer';
  while (now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const fresh = host.readHandshake();
    if (fresh === null) continue;
    try {
      const health = await withTimeout((signal) => getHealth(fresh.port, signal));
      return { ok: true, health, port: fresh.port, token: fresh.token, origin: 'spawned' };
    } catch (error) {
      lastError = (error as Error).message;
    }
  }

  return {
    ok: false,
    error: serviceErrorOf(
      'service-start-timeout',
      `the service was started with ${spawned.nodePath} (${spawned.source}) but did not answer ` +
        `within ${SERVICE_START_TIMEOUT_MS / 1000}s: ${lastError}`,
      true,
    ),
  };
}

/**
 * A service someone else is running, if it answers. Used both before spawning
 * and after a spawn that lost a race.
 */
async function reachExisting(
  host: PanelHost,
): Promise<{ ok: true; health: HealthPayload; port: number; token: string; origin: ServiceOrigin } | null> {
  let handshake: ReturnType<PanelHost['readHandshake']>;
  try {
    handshake = host.readHandshake();
  } catch {
    return null;
  }
  if (handshake === null || !host.processAlive(handshake.pid)) return null;
  try {
    const health = await withTimeout((signal) => getHealth(handshake.port, signal));
    return { ok: true, health, port: handshake.port, token: handshake.token, origin: 'existing' };
  } catch {
    return null;
  }
}

/** Injected in tests so a timeout can be exercised without waiting for one. */
let now = (): number => Date.now();
let sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export function setClockForTests(clock: { now: () => number; sleep: (ms: number) => Promise<void> }): void {
  now = clock.now;
  sleep = clock.sleep;
}

function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  return run(controller.signal).finally(() => clearTimeout(timer));
}

/**
 * The catalogue and the dry run come from the service, never from the panel
 * reading disk. The rule for where footage lives is `frames/footage.ts` and
 * the rule for what a mode is is `core/src/mode.ts`; a second copy inside a
 * React bundle is a second place for them to drift.
 */
export interface Connection {
  port: number;
  token: string;
}

async function getJson<T>(connection: Connection, route: string): Promise<T> {
  const res = await fetch(`http://127.0.0.1:${connection.port}${route}`, {
    headers: { 'x-service-token': connection.token },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Partial<ServiceError>;
    throw new Error(body.cause ?? `HTTP ${res.status} from ${route}`);
  }
  return (await res.json()) as T;
}

/*
 * A payload without the array is a broken service, not an empty catalogue.
 * Passing `undefined` through would crash the render one line later, which is
 * how it first showed up.
 */
export async function fetchReels(connection: Connection): Promise<Reel[]> {
  const body = await getJson<{ reels?: Reel[] }>(connection, '/reels');
  if (!Array.isArray(body.reels)) throw new Error('/reels did not return a list');
  return body.reels;
}

export async function fetchModes(connection: Connection): Promise<ClientMode[]> {
  const body = await getJson<{ modes?: ClientMode[] }>(connection, '/modes');
  if (!Array.isArray(body.modes)) throw new Error('/modes did not return a list');
  return body.modes;
}

export async function fetchDryRun(
  connection: Connection,
  reel: string,
  mode: string,
): Promise<DryRunPlan> {
  return await getJson<DryRunPlan>(
    connection,
    `/dry-run?reel=${encodeURIComponent(reel)}&mode=${encodeURIComponent(mode)}`,
  );
}

export async function fetchSteps(
  connection: Connection,
  reel: string,
  mode: string,
): Promise<PlanSteps> {
  return await getJson<PlanSteps>(
    connection,
    `/steps?reel=${encodeURIComponent(reel)}&mode=${encodeURIComponent(mode)}`,
  );
}

/**
 * Starts a pipeline run and returns the job id. **The job lives in the
 * service**: the panel can be closed, or the user can walk off to another step,
 * and the run carries on. Everything after this is polling.
 */
export async function startPipeline(
  connection: Connection,
  reel: string,
  mode: string,
): Promise<string> {
  const res = await fetch(`http://127.0.0.1:${connection.port}/jobs`, {
    method: 'POST',
    headers: { 'x-service-token': connection.token, 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'pipeline', params: { reel, mode } }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Partial<ServiceError>;
    throw new Error(body.cause ?? body.error ?? `HTTP ${res.status} starting the pipeline`);
  }
  const body = (await res.json()) as { id?: string };
  if (typeof body.id !== 'string') throw new Error('the service started a job without an id');
  return body.id;
}

export async function fetchJob(connection: Connection, id: string): Promise<PipelineJob> {
  return await getJson<PipelineJob>(connection, `/jobs/${encodeURIComponent(id)}`);
}

/**
 * Build the reel. The service spawns the same CLI a terminal would, which
 * drives the running After Effects; this returns as soon as the job exists.
 */
export async function startBuild(
  connection: Connection,
  params: { reel: string; planPath: string; mode?: string },
): Promise<string> {
  const res = await fetch(`http://127.0.0.1:${connection.port}/jobs`, {
    method: 'POST',
    headers: { 'x-service-token': connection.token, 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'build', params }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Partial<ServiceError>;
    throw new Error(body.cause ?? body.error ?? `HTTP ${res.status} starting the build`);
  }
  const body = (await res.json()) as { id?: string };
  if (typeof body.id !== 'string') throw new Error('the service started a build without an id');
  return body.id;
}

export async function fetchBuildJob(connection: Connection, id: string): Promise<BuildJob> {
  return await getJson<BuildJob>(connection, `/jobs/${encodeURIComponent(id)}`);
}

export async function fetchTranscript(
  connection: Connection,
  reel: string,
): Promise<TranscriptView> {
  return await getJson<TranscriptView>(
    connection,
    `/transcript?reel=${encodeURIComponent(reel)}`,
  );
}

async function postJson<T>(connection: Connection, route: string, body: unknown): Promise<T> {
  const res = await fetch(`http://127.0.0.1:${connection.port}${route}`, {
    method: 'POST',
    headers: { 'x-service-token': connection.token, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const failure = (await res.json().catch(() => ({}))) as Partial<ServiceError>;
    throw new Error(failure.cause ?? failure.error ?? `HTTP ${res.status} from ${route}`);
  }
  return (await res.json()) as T;
}

/** Edits one word. Ids and order never change; `edited` is set by the service. */
export async function saveWord(
  connection: Connection,
  edit: {
    planPath: string;
    wordId: string;
    text?: string;
    restore?: boolean;
    script?: 'latin' | 'arabic';
  },
): Promise<{ word: TranscriptWordView; hash: string }> {
  return await postJson(connection, '/transcript/word', edit);
}

export async function saveCard(
  connection: Connection,
  edit: { planPath: string; cardId: string; displayStart: number; displayEnd: number },
): Promise<TranscriptCardView> {
  return await postJson(connection, '/transcript/card', edit);
}

export async function fetchKeywords(
  connection: Connection,
  reel: string,
): Promise<KeywordsView> {
  return await getJson<KeywordsView>(connection, `/keywords?reel=${encodeURIComponent(reel)}`);
}

export async function addKeyword(
  connection: Connection,
  edit: { planPath: string; wordId: string },
): Promise<KeywordsView> {
  return await postJson(connection, '/keywords/add', edit);
}

export async function removeKeyword(
  connection: Connection,
  edit: { planPath: string; keywordId: string },
): Promise<KeywordsView> {
  return await postJson(connection, '/keywords/remove', edit);
}

/**
 * Turn this reel's watermark on or off.
 *
 * Per reel because some deliveries carry the mark and some do not, and the
 * builder used to decide it from whether the asset was on disk — the same
 * answer for every reel.
 */
/** Step 4: every slot with every candidate, rejected ones included. */
export async function fetchImages(connection: Connection, reel: string): Promise<ImagesView> {
  return await getJson<ImagesView>(connection, `/images?reel=${encodeURIComponent(reel)}`);
}

/** Choose a candidate for a slot, or pass null to clear the choice. */
export async function chooseImage(
  connection: Connection,
  edit: { planPath: string; slotId: string; candidateId: string | null },
): Promise<ImagesView> {
  return await postJson(connection, '/images/choose', edit);
}

export async function setWatermark(
  connection: Connection,
  edit: { planPath: string; enabled?: boolean; size?: WatermarkSize },
): Promise<void> {
  await postJson(connection, '/watermark', edit);
}
