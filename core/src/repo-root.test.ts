import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from './paths.js';
import {
  REPO_MARKER_DIRS,
  REPO_PACKAGE_NAME,
  RepoRootError,
  resolveRepoRoot,
  verifyRepoRoot,
  type RepoRootFs,
} from './repo-root.js';

const realFs: RepoRootFs = {
  existsSync,
  readFileSync: (p, enc) => readFileSync(p, enc as BufferEncoding) as string,
  realpathSync,
};

/** A filesystem that is only the paths it was given. */
function fakeFs(present: string[], files: Record<string, string> = {}, links: Record<string, string> = {}): RepoRootFs {
  const set = new Set([...present, ...Object.keys(files)]);
  return {
    existsSync: (p) => set.has(p),
    readFileSync: (p) => files[p] ?? '',
    realpathSync: (p) => {
      for (const [from, to] of Object.entries(links)) {
        if (p === from) return to;
        if (p.startsWith(`${from}/`)) return to + p.slice(from.length);
      }
      if (!set.has(p)) throw new Error(`ENOENT: ${p}`);
      return p;
    },
  };
}

function repoAt(root: string): { present: string[]; files: Record<string, string> } {
  return {
    present: [root, ...REPO_MARKER_DIRS.map((d) => `${root}/${d}`), `${root}/panel`, `${root}/panel/dist`],
    files: { [`${root}/package.json`]: JSON.stringify({ name: REPO_PACKAGE_NAME }) },
  };
}

describe('verifyRepoRoot', () => {
  /* The value that produced `/service/dist/service.js` on the user's screen. */
  it('rejects an empty path', () => {
    expect(verifyRepoRoot(fakeFs([]), '')).toBe('empty path');
  });

  it('rejects a directory with no package.json', () => {
    expect(verifyRepoRoot(fakeFs(['/nope']), '/nope')).toBe('no package.json');
  });

  it('rejects a different project that happens to have one', () => {
    const fs = fakeFs(['/other'], { '/other/package.json': JSON.stringify({ name: 'something-else' }) });
    expect(verifyRepoRoot(fs, '/other')).toContain('something-else');
  });

  it('rejects a package.json that will not parse', () => {
    const fs = fakeFs(['/broken'], { '/broken/package.json': '{ not json' });
    expect(verifyRepoRoot(fs, '/broken')).toBe('package.json did not parse');
  });

  it('rejects the repo with a marker directory missing', () => {
    const { present, files } = repoAt('/repo');
    const fs = fakeFs(present.filter((p) => p !== '/repo/modes'), files);
    expect(verifyRepoRoot(fs, '/repo')).toBe('no modes/ directory');
  });

  it('accepts the real repository', () => {
    expect(verifyRepoRoot(realFs, REPO_ROOT)).toBeNull();
  });
});

describe('resolveRepoRoot', () => {
  const { present, files } = repoAt('/repo');

  it('takes the first candidate that verifies', () => {
    const fs = fakeFs(present, files);
    const result = resolveRepoRoot({
      fs,
      candidates: [
        { source: 'a', path: null },
        { source: 'b', path: '/repo/panel' },
      ],
    });
    expect(result.root).toBe('/repo');
    expect(result.source).toBe('b');
  });

  /* CEP always loads the extension through a symlink. */
  it('follows a symlink rather than walking .. from the link', () => {
    const fs = fakeFs(present, files, {
      '/Users/x/Library/Application Support/Adobe/CEP/extensions/com.framopia.studio': '/repo/panel',
    });
    const result = resolveRepoRoot({
      fs,
      candidates: [
        {
          source: 'CEP',
          path: '/Users/x/Library/Application Support/Adobe/CEP/extensions/com.framopia.studio/dist',
        },
      ],
    });
    expect(result.root).toBe('/repo');
  });

  it('walks up from panel/dist as readily as from panel', () => {
    const fs = fakeFs(present, files);
    expect(resolveRepoRoot({ fs, candidates: [{ source: 'x', path: '/repo/panel/dist' }] }).root).toBe('/repo');
  });

  /*
   * The whole reason this module exists. An empty root composed silently into
   * `/service/dist/service.js` and the panel told the user to build a file
   * that could never be there.
   */
  it('never returns an empty string; it throws naming every attempt', () => {
    const fs = fakeFs(['/']);
    let error: RepoRootError | null = null;
    try {
      resolveRepoRoot({
        fs,
        candidates: [
          { source: '__adobe_cep__.getSystemPath', path: null },
          { source: 'CSInterface.getSystemPath', path: '' },
          { source: 'window.location', path: '/' },
        ],
      });
    } catch (e) {
      error = e as RepoRootError;
    }

    expect(error).toBeInstanceOf(RepoRootError);
    expect(error?.attempts).toHaveLength(3);
    expect(error?.message).toContain('__adobe_cep__.getSystemPath');
    expect(error?.message).toContain('CSInterface.getSystemPath');
    expect(error?.message).toContain('window.location');
    expect(error?.message).toContain('(nothing)');
  });

  it('records what each candidate returned, including the ones that failed', () => {
    const fs = fakeFs(present, files);
    const result = resolveRepoRoot({
      fs,
      candidates: [
        { source: 'empty', path: '' },
        { source: 'missing', path: '/not/there' },
        { source: 'good', path: '/repo' },
      ],
    });
    expect(result.attempts.map((a) => a.source)).toEqual(['empty', 'missing', 'good']);
    expect(result.attempts[0]?.outcome).toContain('nothing');
    expect(result.attempts[1]?.outcome).toContain('could not be resolved');
    expect(result.attempts[2]?.outcome).toBe('accepted');
  });

  it('does not accept a directory above the repository', () => {
    const fs = fakeFs(present, files);
    expect(() => resolveRepoRoot({ fs, candidates: [{ source: 'up', path: '/' }] })).toThrow(RepoRootError);
  });
});

/**
 * The rule has one implementation and both workspaces take it. A second copy
 * is what let the panel resolve `/` while the service resolved correctly.
 */
describe('the single home', () => {
  it('is what core exports as REPO_ROOT', () => {
    expect(verifyRepoRoot(realFs, REPO_ROOT)).toBeNull();
    expect(REPO_ROOT).not.toBe('');
    expect(REPO_ROOT.endsWith('framopia-studio')).toBe(true);
  });

  it('is the only implementation: nothing derives a root by walking ..', () => {
    const panelHost = readFileSync(`${REPO_ROOT}/panel/src/host.ts`, 'utf8');
    const paths = readFileSync(`${REPO_ROOT}/core/src/paths.ts`, 'utf8');

    expect(panelHost).toContain('resolveRepoRoot');
    expect(paths).toContain('resolveRepoRoot');
    // The retired shape: resolve(something, '..') as a root.
    expect(panelHost).not.toMatch(/return\s+path\.resolve\([^)]*'\.\.'\)/);
  });
});
