import { readdirSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from './paths.js';
import {
  REPO_ANCHORS,
  StoredPathError,
  classifyStoredPath,
  repoRelativeTail,
  resolveStoredPath,
} from './stored-path.js';

/* Two roots that are not this one, so no test depends on where it is run. */
const OLD = '/Volumes/T7 Shield/INSEA/Projects/framopia-studio';
const NEW = '/Users/someone/work/framopia';

const at = (root: string, tail: string): string => path.join(root, tail);

describe('REPO_ANCHORS', () => {
  /*
   * Pinned against the real listing: a new top-level directory would otherwise
   * make every stored path under it silently unresolvable, which is exactly the
   * failure this module exists to prevent.
   */
  it('is every top-level directory the repository owns', () => {
    const onDisk = readdirSync(REPO_ROOT, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .filter((n) => n !== 'node_modules' && n !== '.git' && !n.startsWith('.') )
      .sort();
    const declared = [...REPO_ANCHORS].filter((n) => !n.startsWith('.')).sort();
    expect(declared).toEqual(onDisk);
  });

  it('includes .local, which is gitignored and holds the cache', () => {
    expect(REPO_ANCHORS).toContain('.local');
    expect(existsSync(path.join(REPO_ROOT, '.local'))).toBe(true);
  });
});

describe('repoRelativeTail', () => {
  it('cuts at the first anchor, because a root is a prefix', () => {
    expect(repoRelativeTail(at(OLD, 'my files/test videos/a.mov'))).toBe(
      'my files/test videos/a.mov',
    );
    expect(repoRelativeTail(at(OLD, '.local/cache/abc/images-def/image.jpg'))).toBe(
      '.local/cache/abc/images-def/image.jpg',
    );
  });

  /* `cutouts` sits under `my files`; a backwards scan would split there. */
  it('does not cut at a later anchor-looking segment', () => {
    expect(repoRelativeTail(at(OLD, 'my files/test videos/cutouts/vitasilk/a.png'))).toBe(
      'my files/test videos/cutouts/vitasilk/a.png',
    );
  });

  it('is null for a path that belongs to nobody here', () => {
    expect(repoRelativeTail('/Users/someone/Pictures/clinic.jpg')).toBeNull();
  });

  it('matches whole segments, never a substring', () => {
    expect(repoRelativeTail('/x/coreutils/y/z')).toBeNull();
    expect(repoRelativeTail('/x/my filesystem/y')).toBeNull();
  });
});

describe('resolveStoredPath', () => {
  it('leaves a path already inside this repository alone', () => {
    const here = at(NEW, 'modes/k2-syndicalia.json');
    expect(resolveStoredPath(here, { repoRoot: NEW })).toBe(here);
  });

  /* The whole point: a plan written on one drive, read on another. */
  it.each([
    ['my files/test videos/vitasilk.mov'],
    ['.local/audio/vitasilk.wav'],
    ['modes/k2-syndicalia.json'],
    ['assets/watermark/intro.mov'],
    ['.local/cache/99df/images-699c/image.jpg'],
    ['my files/test videos/cutouts/vitasilk/img001-c1.cutout.png'],
    // Since session 62 a client's photograph is one of these.
    ['assets/client-pictures/dr-loubna-kfafi/pic001.png'],
  ])('re-roots %s from another repository onto this one', (tail) => {
    expect(resolveStoredPath(at(OLD, tail), { repoRoot: NEW })).toBe(at(NEW, tail));
  });

  /*
   * **A photograph attached before session 62 still lives where its owner put
   * it**, and is left alone: nothing re-roots it and nothing moves it. Only
   * newly attached ones are copied in, and there is no migration — a path
   * written the old way has to keep working.
   */
  it('leaves a path outside any repository alone', () => {
    const outside = '/Users/someone/Pictures/the clinic exterior.jpg';
    expect(resolveStoredPath(outside, { repoRoot: NEW })).toBe(outside);
  });

  /*
   * Checked before the anchor scan, so a repository whose own path contains a
   * word like `docs` is not split at that word.
   */
  it('is not confused by a repository whose path contains an anchor word', () => {
    const root = '/Users/someone/docs/framopia';
    const stored = at(root, 'my files/test videos/a.mov');
    expect(resolveStoredPath(stored, { repoRoot: root })).toBe(stored);
  });

  it('throws on a relative path rather than guessing a root', () => {
    expect(() => resolveStoredPath('my files/a.mov', { repoRoot: NEW })).toThrow(StoredPathError);
  });

  it('throws on an empty value', () => {
    expect(() => resolveStoredPath('', { repoRoot: NEW })).toThrow(StoredPathError);
    expect(() => resolveStoredPath('   ', { repoRoot: NEW })).toThrow(StoredPathError);
  });

  it('names the field it was given, so a throw says which one held the bad value', () => {
    expect(() => resolveStoredPath('nope', { repoRoot: NEW, field: 'source.videoPath' })).toThrow(
      /source\.videoPath/u,
    );
  });

  it('defaults to the repository running now', () => {
    expect(resolveStoredPath(at(OLD, 'modes/k2-syndicalia.json'))).toBe(
      path.join(REPO_ROOT, 'modes/k2-syndicalia.json'),
    );
  });
});

describe('classifyStoredPath', () => {
  it('says which of the three happened', () => {
    expect(classifyStoredPath(at(NEW, 'modes/a.json'), { repoRoot: NEW })).toBe('already-here');
    expect(classifyStoredPath(at(OLD, 'modes/a.json'), { repoRoot: NEW })).toBe('re-rooted');
    expect(classifyStoredPath('/Users/x/p.jpg', { repoRoot: NEW })).toBe('outside-the-repo');
  });
});

/*
 * The corpus as it stands: every stored path on every plan must resolve, and on
 * this machine every one of them is already here.
 */
describe('the five Edit Plans', () => {
  it('every absolute path they carry resolves without throwing', async () => {
    const { readFileSync } = await import('node:fs');
    const dir = path.join(REPO_ROOT, 'my files', 'test videos');
    let checked = 0;
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.editplan.json'))) {
      const plan = JSON.parse(readFileSync(path.join(dir, file), 'utf8')) as unknown;
      const walk = (o: unknown): void => {
        if (Array.isArray(o)) o.forEach(walk);
        else if (o !== null && typeof o === 'object') Object.values(o).forEach(walk);
        else if (typeof o === 'string' && path.isAbsolute(o) && o.startsWith('/')) {
          checked += 1;
          expect(() => resolveStoredPath(o), `${file}: ${o}`).not.toThrow();
        }
      };
      walk(plan);
    }
    expect(checked).toBeGreaterThan(50);
  });
});

/**
 * **The doctor's footage check, which reported a green nobody had earned.**
 *
 * `benchmarks/footage.json` records absolute paths written on the T7 Shield, and
 * `tools/doctor/checks.ts` read them as they stood. So a clone on any machine
 * that could *see* that drive found the five reels on it and reported "5 of 5
 * present" while holding none — Block 11 session 64 measured exactly that, in
 * the rehearsal clone, and every rehearsal on record ran on such a machine.
 *
 * `tools/` has no test suite of its own, which is how a check nobody had
 * watched fail stayed wrong. These two assert the property from core, where the
 * resolver lives.
 */
describe('the footage catalogue', () => {
  const catalogue = JSON.parse(
    readFileSync(path.join(REPO_ROOT, 'benchmarks', 'footage.json'), 'utf8'),
  ) as { reels: { label: string; path: string }[] };

  it('asks about the repository running now, not the one it was written on', () => {
    const elsewhere = path.join(path.sep, 'Volumes', 'Another Drive', 'framopia-studio');
    for (const reel of catalogue.reels) {
      const resolved = resolveStoredPath(reel.path, { repoRoot: elsewhere });
      // Re-rooted, not returned as it stood: `my files` is a REPO_ANCHOR.
      expect(`${reel.label}: ${resolved.startsWith(elsewhere + path.sep)}`).toBe(
        `${reel.label}: true`,
      );
      expect(`${reel.label}: ${path.basename(resolved)}`).toBe(
        `${reel.label}: ${path.basename(reel.path)}`,
      );
    }
  });

  /*
   * The guard on the check itself. Reading the stored path raw is the defect,
   * and the only thing that ever caught it was a person running the doctor on a
   * machine that happened not to have the drive.
   */
  it('is read through the resolver by the doctor, not as it stands', () => {
    const checks = readFileSync(path.join(REPO_ROOT, 'tools', 'doctor', 'checks.ts'), 'utf8');
    expect(checks).toContain('resolveStoredPath');
    const code = checks.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toContain('dir === undefined ? reel.path');
  });
});
