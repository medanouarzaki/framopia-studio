/**
 * Where Node actually is on this machine.
 *
 * After Effects launches from the Finder and inherits none of the user's shell
 * profile, so `PATH` inside a CEP panel is roughly `/usr/bin:/bin`. Spawning
 * `npm` there fails with `spawn npm ENOENT`, and Node installed through nvm is
 * not on that path either.
 *
 * **Nothing here is hardcoded.** The nvm path carries the version in the
 * directory name, so a literal breaks on the next upgrade and is wrong on the
 * partner's machine — and Block 10 installs this on a second Mac.
 *
 * Filesystem access is injected so the panel can supply CEP's `fs` and a test
 * can supply neither.
 */
export interface NodeFs {
  existsSync: (p: string) => boolean;
  readFileSync: (p: string, enc: string) => string;
  readdirSync: (p: string) => string[];
}

export type NodePathSource =
  | 'config'
  | 'process.execPath'
  | 'nvm'
  | 'homebrew'
  | 'usr-local';

export interface ResolvedNode {
  path: string;
  source: NodePathSource;
}

export interface ResolveNodeOptions {
  fs: NodeFs;
  /** Repo root, for `.local/config.json`. */
  repo: string;
  /** The running interpreter, when there is one. Inside CEP this is After Effects. */
  execPath?: string;
  /** `$HOME`, for the nvm search. */
  home: string;
  /** Path separator handling is trivial here; POSIX only, which is the only platform this ships on. */
  join?: (...parts: string[]) => string;
}

const HOMEBREW = '/opt/homebrew/bin/node';
const USR_LOCAL = '/usr/local/bin/node';

function defaultJoin(...parts: string[]): string {
  return parts.join('/').replace(/\/+/g, '/');
}

/**
 * nvm directories are `v24.14.1`, so sorting them as strings puts v9 above
 * v24. Compared numerically, newest first; anything unparseable sorts last
 * rather than being dropped, so an oddly named directory is still usable.
 */
export function newestNvmNode(fs: NodeFs, home: string, join = defaultJoin): string | null {
  const versionsDir = join(home, '.nvm', 'versions', 'node');
  if (!fs.existsSync(versionsDir)) return null;
  let names: string[];
  try {
    names = fs.readdirSync(versionsDir);
  } catch {
    return null;
  }
  const parse = (name: string): number[] => {
    const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(name);
    return m === null ? [-1, -1, -1] : [Number(m[1]), Number(m[2]), Number(m[3])];
  };
  const sorted = [...names].sort((a, b) => {
    const pa = parse(a);
    const pb = parse(b);
    for (let i = 0; i < 3; i += 1) {
      if (pa[i] !== pb[i]) return (pb[i] as number) - (pa[i] as number);
    }
    return b.localeCompare(a);
  });
  for (const name of sorted) {
    const candidate = join(versionsDir, name, 'bin', 'node');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * `process.execPath` is only Node when the process *is* Node. Inside CEP it is
 * After Effects, and spawning that would open a second copy of the
 * application.
 */
function execPathIsNode(execPath: string | undefined): boolean {
  if (execPath === undefined || execPath === '') return false;
  const base = execPath.split('/').pop() ?? '';
  return base === 'node' || /^node[\d.]*$/.test(base);
}

export function resolveNodePath(options: ResolveNodeOptions): ResolvedNode | null {
  const { fs, repo, execPath, home } = options;
  const join = options.join ?? defaultJoin;

  const configPath = join(repo, '.local', 'config.json');
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as { nodePath?: unknown };
      if (typeof config.nodePath === 'string' && config.nodePath !== '' && fs.existsSync(config.nodePath)) {
        return { path: config.nodePath, source: 'config' };
      }
    } catch {
      // A broken config must not stop the search; the later sources still work.
    }
  }

  if (execPathIsNode(execPath) && fs.existsSync(execPath as string)) {
    return { path: execPath as string, source: 'process.execPath' };
  }

  const nvm = newestNvmNode(fs, home, join);
  if (nvm !== null) return { path: nvm, source: 'nvm' };

  if (fs.existsSync(HOMEBREW)) return { path: HOMEBREW, source: 'homebrew' };
  if (fs.existsSync(USR_LOCAL)) return { path: USR_LOCAL, source: 'usr-local' };

  return null;
}

/** What the panel shows when nothing resolved. Actionable, not a diagnosis. */
export const NODE_NOT_FOUND_HELP =
  'No Node interpreter could be found. After Effects starts from the Finder and does not ' +
  'inherit your shell PATH, so a Node installed through nvm is invisible to it. Add ' +
  '{"nodePath": "/absolute/path/to/node"} to .local/config.json — `which node` in a terminal ' +
  'prints the path — then reopen the panel.';
