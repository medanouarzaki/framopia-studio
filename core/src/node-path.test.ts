import { describe, expect, it } from 'vitest';
import { newestNvmNode, resolveNodePath, type NodeFs } from './node-path.js';

/** A filesystem that exists only as a set of paths and a config blob. */
function fakeFs(paths: string[], files: Record<string, string> = {}): NodeFs {
  const set = new Set(paths);
  return {
    existsSync: (p) => set.has(p) || p in files,
    readFileSync: (p) => files[p] ?? '',
    readdirSync: (p) => {
      const prefix = `${p}/`;
      return [
        ...new Set(
          [...set, ...Object.keys(files)]
            .filter((f) => f.startsWith(prefix))
            .map((f) => f.slice(prefix.length).split('/')[0] as string),
        ),
      ];
    },
  };
}

const NVM = '/home/.nvm/versions/node';
const base = { repo: '/repo', home: '/home' };

describe('resolveNodePath', () => {
  it('prefers an explicit path in .local/config.json', () => {
    const fs = fakeFs(['/custom/node', `${NVM}/v24.14.1/bin/node`, NVM], {
      '/repo/.local/config.json': JSON.stringify({ nodePath: '/custom/node' }),
    });
    expect(resolveNodePath({ ...base, fs })).toEqual({ path: '/custom/node', source: 'config' });
  });

  it('ignores a config that names a path which is not there', () => {
    const fs = fakeFs([`${NVM}/v24.14.1/bin/node`, NVM], {
      '/repo/.local/config.json': JSON.stringify({ nodePath: '/gone/node' }),
    });
    expect(resolveNodePath({ ...base, fs })?.source).toBe('nvm');
  });

  it('survives a config that will not parse', () => {
    const fs = fakeFs([`${NVM}/v24.14.1/bin/node`, NVM], { '/repo/.local/config.json': '{ not json' });
    expect(resolveNodePath({ ...base, fs })?.source).toBe('nvm');
  });

  it('takes the running interpreter when it really is node', () => {
    const fs = fakeFs(['/usr/local/bin/node']);
    expect(resolveNodePath({ ...base, fs, execPath: '/usr/local/bin/node' })).toEqual({
      path: '/usr/local/bin/node',
      source: 'process.execPath',
    });
  });

  /*
   * Inside CEP `process.execPath` is After Effects. Spawning it would open a
   * second copy of the application.
   */
  it('refuses an execPath that is not node', () => {
    const ae = '/Applications/Adobe After Effects 2026/Adobe After Effects 2026.app/Contents/MacOS/After Effects';
    const fs = fakeFs([ae, `${NVM}/v24.14.1/bin/node`, NVM]);
    expect(resolveNodePath({ ...base, fs, execPath: ae })?.source).toBe('nvm');
  });

  it('falls back to homebrew, then /usr/local', () => {
    expect(resolveNodePath({ ...base, fs: fakeFs(['/opt/homebrew/bin/node']) })).toEqual({
      path: '/opt/homebrew/bin/node',
      source: 'homebrew',
    });
    expect(resolveNodePath({ ...base, fs: fakeFs(['/usr/local/bin/node']) })).toEqual({
      path: '/usr/local/bin/node',
      source: 'usr-local',
    });
  });

  it('returns null when nothing resolves, rather than guessing', () => {
    expect(resolveNodePath({ ...base, fs: fakeFs([]) })).toBeNull();
  });
});

describe('newestNvmNode', () => {
  /*
   * nvm names directories `v24.14.1`, so string order puts v9 above v24. The
   * version has to be compared numerically or an upgrade silently downgrades
   * the interpreter the panel spawns.
   */
  it('takes the highest version, not the highest string', () => {
    const fs = fakeFs([
      NVM,
      `${NVM}/v9.11.2/bin/node`,
      `${NVM}/v24.14.1/bin/node`,
      `${NVM}/v20.11.0/bin/node`,
    ]);
    expect(newestNvmNode(fs, '/home')).toBe(`${NVM}/v24.14.1/bin/node`);
  });

  it('compares minor and patch too', () => {
    const fs = fakeFs([NVM, `${NVM}/v24.2.0/bin/node`, `${NVM}/v24.14.1/bin/node`]);
    expect(newestNvmNode(fs, '/home')).toBe(`${NVM}/v24.14.1/bin/node`);
  });

  it('skips a version directory with no binary in it', () => {
    const fs = fakeFs([NVM, `${NVM}/v25.0.0`, `${NVM}/v24.14.1/bin/node`]);
    expect(newestNvmNode(fs, '/home')).toBe(`${NVM}/v24.14.1/bin/node`);
  });

  it('is null when nvm is not installed', () => {
    expect(newestNvmNode(fakeFs([]), '/home')).toBeNull();
  });
});
