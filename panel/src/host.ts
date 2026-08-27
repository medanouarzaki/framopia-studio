import { processAlive } from '@framopia/core/process-alive';
import { NODE_NOT_FOUND_HELP, resolveNodePath } from '@framopia/core/node-path';
import type { PanelHost, SpawnResult } from './service.js';
import type { HostEnvironment } from './types.js';

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
  realpathSync: (p: string) => string;
};
interface SpawnedProcess {
  unref: () => void;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  stderr: { on: (event: string, listener: (chunk: unknown) => void) => void } | null;
}
type ChildProcessModule = {
  spawn: (cmd: string, args: string[], options: Record<string, unknown>) => SpawnedProcess;
};

/**
 * The repo root, derived from where this extension is installed. The panel is
 * symlinked from `panel/`, so the root is two levels up — and CEP resolves the
 * symlink, which is what makes this work rather than pointing into the
 * extensions folder.
 */
export function repoRoot(extensionPath: string): string {
  const path = requireCepNode().require('path') as { resolve: (...p: string[]) => string };
  const fs = requireCepNode().require('fs') as FsModule;
  /*
   * `getSystemPath('extension')` returns the path CEP was given, which is the
   * symlink in ~/Library/.../CEP/extensions — not its target. Resolving `..`
   * from it lands in the extensions folder, where there is no footage.json, no
   * modes/ and no brand assets, which is why all three pickers were empty and
   * the logo fell back to a coloured square. The symlink has to be followed.
   */
  const real = fs.realpathSync(extensionPath);
  return path.resolve(real, '..');
}

/** Long enough for an ENOENT or an immediate exit to arrive. Chosen, not measured. */
const SPAWN_SETTLE_MS = 400;

export function createHost(repo: string): PanelHost {
  const fs = requireCepNode().require('fs') as FsModule;
  const path = requireCepNode().require('path') as { join: (...p: string[]) => string };
  const childProcess = requireCepNode().require('child_process') as ChildProcessModule;
  const os = requireCepNode().require('os') as { homedir: () => string };
  const homeDir = (): string => os.homedir();
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
    resolveNode() {
      return resolveNodePath({ fs, repo, execPath: undefined, home: homeDir() });
    },
    async spawnService() {
      const node = resolveNodePath({ fs, repo, execPath: undefined, home: homeDir() });
      if (node === null) return { ok: false as const, cause: NODE_NOT_FOUND_HELP };

      const entry = path.join(repo, 'service', 'dist', 'service.js');
      if (!fs.existsSync(entry)) {
        return {
          ok: false as const,
          cause:
            `the service is not built: ${entry} does not exist. Run ` +
            '`npm run service:build` in the repository, then reopen the panel.',
          nodePath: node.path,
        };
      }

      /*
       * The Node binary directly, never `npm` and never through a shell. After
       * Effects launches from the Finder and inherits no shell profile, so its
       * PATH is roughly /usr/bin:/bin — `spawn npm` fails ENOENT, which is
       * exactly what the panel reported while telling the user a service had
       * started.
       */
      let child: SpawnedProcess;
      try {
        child = childProcess.spawn(node.path, [entry], {
          cwd: repo,
          detached: true,
          stdio: ['ignore', 'ignore', 'pipe'],
        });
      } catch (error) {
        return { ok: false as const, cause: (error as Error).message, nodePath: node.path };
      }

      /*
       * ENOENT arrives on the 'error' event, after spawn() has returned, and a
       * service that starts and dies exits within milliseconds. Neither is
       * visible synchronously, so this waits long enough to catch both rather
       * than reporting success the instant spawn() returns.
       */
      return await new Promise<SpawnResult>((resolve) => {
        let stderr = '';
        let settled = false;
        const finish = (result: SpawnResult): void => {
          if (settled) return;
          settled = true;
          resolve(result);
        };

        child.stderr?.on('data', (chunk) => {
          stderr += String(chunk);
        });
        child.on('error', (error) => {
          finish({ ok: false, cause: `${(error as Error).message}`, nodePath: node.path });
        });
        child.on('exit', (code) => {
          finish({
            ok: false,
            cause:
              `the service exited immediately with code ${String(code)}` +
              (stderr.trim() === '' ? '' : `: ${stderr.trim().split('\n').slice(-3).join(' ')}`),
            nodePath: node.path,
          });
        });
        setTimeout(() => {
          child.unref();
          finish({ ok: true, nodePath: node.path, source: node.source });
        }, SPAWN_SETTLE_MS);
      });
    },
  };
}

/**
 * PROJECT_SPEC §6 puts the logo at `assets/brand/Framopia_LOGO.png`. Returns
 * null when it is not on disk so the header falls back to the wordmark rather
 * than rendering a broken image.
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
