import {
  loadMode as loadModeFromDisk,
  snapshotIsBehind,
  snapshotOfMode,
  type ClientMode,
  type ClientSnapshot,
} from '@framopia/core';
import type { EditPlan } from '../editplan/types.js';

/**
 * Which client look a build will use, and where it came from.
 *
 * One declaration, read by the builder and by `steps.ts` so the panel cannot
 * say one thing while the build does another — guidelines §3, the same rule
 * that pins `buildOutputPath`.
 *
 * The order is: an explicit `--mode` wins, because someone typed it; then the
 * reel's own snapshot, because that is what it was approved as; then the live
 * mode file, which is what every plan did before snapshots existed. **The
 * fallback is reported, never assumed** — a build that quietly read a mode file
 * is the failure the snapshot exists to prevent, so it has to be visible when
 * it happens.
 */
export type ClientIdentitySource = 'plan' | 'live-mode' | 'override' | 'none';

export interface ResolvedClientIdentity {
  snapshot: ClientSnapshot | null;
  source: ClientIdentitySource;
  /** The sentence the build prints and the panel shows. */
  note: string;
  /**
   * True when the reel is pinned and the client has changed since. Null when
   * there is nothing to compare — no snapshot, or no mode file to read.
   */
  behind: boolean | null;
}

export interface ResolveClientIdentityOptions {
  /** An explicit `--mode`, which overrides the pin. */
  modeIdOverride?: string;
  /** Injected by tests; the real one reads modes/ from disk. */
  loadMode?: (id: string) => ClientMode;
  now?: () => string;
}

export function resolveClientIdentity(
  plan: Pick<EditPlan, 'clientMode' | 'clientSnapshot'>,
  options: ResolveClientIdentityOptions = {},
): ResolvedClientIdentity {
  const loadMode = options.loadMode ?? loadModeFromDisk;
  const now = options.now ?? ((): string => new Date().toISOString());
  const pinned = plan.clientSnapshot ?? null;

  if (options.modeIdOverride !== undefined) {
    const mode = loadMode(options.modeIdOverride);
    return {
      snapshot: snapshotOfMode(mode, now()),
      source: 'override',
      note:
        `using ${mode.name} as it is now, because it was asked for explicitly` +
        (pinned === null ? '' : ` (this video is saved with ${pinned.name} as it was)`),
      behind: null,
    };
  }

  if (pinned !== null) {
    let behind: boolean | null = null;
    try {
      behind = snapshotIsBehind(pinned, loadMode(pinned.id));
    } catch {
      // The client's file has been renamed or removed. The reel still builds
      // exactly as it was approved, which is the point; there is simply
      // nothing to compare it against.
      behind = null;
    }
    return {
      snapshot: pinned,
      source: 'plan',
      note: `using ${pinned.name} as it was saved for this video`,
      behind,
    };
  }

  const id = plan.clientMode?.id;
  if (id === undefined) {
    return {
      snapshot: null,
      source: 'none',
      note: 'no client for this video, so each card keeps the template’s own colours',
      behind: null,
    };
  }
  const mode = loadMode(id);
  return {
    snapshot: snapshotOfMode(mode, now()),
    source: 'live-mode',
    note:
      `using ${mode.name} as it is now: this video has no saved copy of the client’s ` +
      'look, so it follows whatever the client file says today',
    behind: null,
  };
}
