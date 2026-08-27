import { processAlive } from '@framopia/core/process-alive';
import type { PanelHost } from './service.js';
import type { ClientMode, HostEnvironment, Reel } from './types.js';

/**
 * The CEP side. Everything that needs Node — reading the handshake, spawning
 * the service, listing reels and modes — lives behind this one module, so the
 * screen itself can be rendered in a test with no host at all.
 *
 * CEP exposes Node through `window.cep_node` when the manifest asks for it.
 * Nothing here is imported statically: a bundler resolving `node:fs` would put
 * a shim in the bundle and hide the fact that this only works inside AE.
 */
interface CepNode {
  require: (id: string) => unknown;
  global: Record<string, unknown>;
}

/**
 * `cep_node` or nothing. CEP puts it on the page's window — which is
 * `globalThis` here — but only when the manifest declares `--enable-nodejs`
 * *and* `--mixed-context`; with either missing the panel loads into a Chromium
 * with no Node at all.
 *
 * **This returns null rather than throwing**, and every caller is written to
 * cope. A missing capability is a state the panel renders, not an exception at
 * module load: the first version threw here, the throw ran before React
 * mounted, and the user got a black rectangle instead of the error surface
 * built for exactly this.
 */
function cepNode(): CepNode | null {
  return (globalThis as { cep_node?: CepNode }).cep_node ?? null;
}

export function cepNodeAvailable(): boolean {
  return cepNode() !== null;
}

function requireCepNode(): CepNode {
  const node = cepNode();
  if (node === null) {
    // Reached only from inside detectHost's try, never at module load.
    throw new Error(
      'cep_node is not available. The manifest must declare --enable-nodejs and ' +
        '--mixed-context in <CEFCommandLine>, and After Effects must be restarted after ' +
        'that change.',
    );
  }
  return node;
}

type FsModule = {
  existsSync: (p: string) => boolean;
  readFileSync: (p: string, enc: string) => string;
  readdirSync: (p: string) => string[];
};
type ChildProcessModule = {
  spawn: (cmd: string, args: string[], options: Record<string, unknown>) => { unref: () => void };
};

/**
 * The repo root, derived from where this extension is installed. The panel is
 * symlinked from `panel/`, so the root is two levels up — and CEP resolves the
 * symlink, which is what makes this work rather than pointing into the
 * extensions folder.
 */
export function repoRoot(extensionPath: string): string {
  const path = requireCepNode().require('path') as { resolve: (...p: string[]) => string };
  return path.resolve(extensionPath, '..');
}

export function createHost(repo: string): PanelHost {
  const fs = requireCepNode().require('fs') as FsModule;
  const path = requireCepNode().require('path') as { join: (...p: string[]) => string };
  const child = requireCepNode().require('child_process') as ChildProcessModule;
  const handshakePath = path.join(repo, '.local', 'service.json');

  return {
    readHandshake() {
      if (!fs.existsSync(handshakePath)) return null;
      try {
        const raw = JSON.parse(fs.readFileSync(handshakePath, 'utf8')) as Record<string, unknown>;
        if (typeof raw['port'] !== 'number' || typeof raw['token'] !== 'string') return null;
        return {
          port: raw['port'],
          token: raw['token'],
          pid: typeof raw['pid'] === 'number' ? raw['pid'] : 0,
        };
      } catch {
        return null;
      }
    },
    processAlive,
    spawnService() {
      const proc = child.spawn('npm', ['run', 'start', '--prefix', 'service'], {
        cwd: repo,
        detached: true,
        stdio: 'ignore',
      });
      proc.unref();
    },
  };
}

/** The reels this machine has, from `benchmarks/footage.json` plus each plan's spend. */
export function loadReels(repo: string): Reel[] {
  const fs = requireCepNode().require('fs') as FsModule;
  const path = requireCepNode().require('path') as { join: (...p: string[]) => string; basename: (p: string, e?: string) => string };
  const footagePath = path.join(repo, 'benchmarks', 'footage.json');
  if (!fs.existsSync(footagePath)) return [];

  const footage = JSON.parse(fs.readFileSync(footagePath, 'utf8')) as {
    reels: { label: string; path: string; durationS?: number }[];
  };

  return footage.reels
    .filter((r) => fs.existsSync(r.path))
    .map((r) => {
      const planPath = r.path.replace(/\.[^.]+$/, '.editplan.json');
      let spentUsd: number | null = null;
      let hasPlan = false;
      if (fs.existsSync(planPath)) {
        hasPlan = true;
        try {
          const plan = JSON.parse(fs.readFileSync(planPath, 'utf8')) as {
            costs?: { spentUsd?: number };
          };
          spentUsd = typeof plan.costs?.spentUsd === 'number' ? plan.costs.spentUsd : null;
        } catch {
          spentUsd = null;
        }
      }
      return {
        label: r.label,
        videoPath: r.path,
        planPath: hasPlan ? planPath : null,
        durationS: r.durationS ?? null,
        spentUsd,
      };
    });
}

/** The client modes in `modes/`, read the same way `validate:modes` reads them. */
export function loadModes(repo: string): ClientMode[] {
  const fs = requireCepNode().require('fs') as FsModule;
  const path = requireCepNode().require('path') as { join: (...p: string[]) => string };
  const dir = path.join(repo, 'modes');
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .flatMap((file) => {
      try {
        const mode = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as {
          id?: string;
          name?: string;
          version?: number;
          fonts?: { status?: string };
        };
        if (typeof mode.id !== 'string') return [];
        return [
          {
            id: mode.id,
            name: typeof mode.name === 'string' ? mode.name : mode.id,
            version: typeof mode.version === 'number' ? mode.version : 0,
            fontsResolved: mode.fonts?.status === 'resolved',
          },
        ];
      } catch {
        return [];
      }
    });
}

/**
 * PROJECT_SPEC §6 puts the logo at `assets/brand/Framopia_LOGO.png`. It is not
 * in the repo yet, so this returns null rather than a path that renders as a
 * broken image, and the panel falls back to the wordmark.
 */
export function logoPath(repo: string): string | null {
  const fs = requireCepNode().require('fs') as FsModule;
  const path = requireCepNode().require('path') as { join: (...p: string[]) => string };
  const file = path.join(repo, 'assets', 'brand', 'Framopia_LOGO.png');
  return fs.existsSync(file) ? `file://${file}` : null;
}

interface CSInterfaceLike {
  getSystemPath: (type: string) => string;
}

/**
 * Resolves everything host-dependent, or reports why it cannot. **It never
 * throws**: startup has no error surface of its own, so anything thrown here
 * reaches the user as a blank panel.
 *
 * The two failures are told apart deliberately. No `cep_node` means the
 * manifest or the AE restart, and the fix is a rebuild and a relaunch; a
 * `cep_node` that is present but unusable is something else entirely, and
 * telling the user "not running inside After Effects" when he plainly is would
 * send him looking in the wrong place.
 */
export function detectHost(): HostEnvironment {
  if (!cepNodeAvailable()) {
    return {
      available: false,
      missing: 'cep_node',
      cause:
        'After Effects did not give this panel access to Node. The extension manifest must ' +
        'declare --enable-nodejs and --mixed-context, and After Effects must be restarted ' +
        'after that change.',
      prevents:
        'Nothing can be read from disk, so the reel list, the client modes and the ' +
        'companion service are all unavailable.',
    };
  }

  try {
    const csInterface = (globalThis as { CSInterface?: new () => CSInterfaceLike }).CSInterface;
    const extensionPath = csInterface === undefined ? '' : new csInterface().getSystemPath('extension');
    const repo = repoRoot(extensionPath);
    return {
      available: true,
      repo,
      host: createHost(repo),
      loadReels: () => Promise.resolve(loadReels(repo)),
      loadModes: () => Promise.resolve(loadModes(repo)),
      logoSrc: logoPath(repo),
    };
  } catch (error) {
    return {
      available: false,
      missing: 'host bridge',
      cause: `Node is available but the panel could not resolve its own location: ${(error as Error).message}`,
      prevents: 'The repository root is unknown, so nothing on disk can be found.',
    };
  }
}
