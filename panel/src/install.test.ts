import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdtempSync, readlinkSync, rmSync, symlinkSync, mkdirSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * **`npm run panel:install`, which no rehearsal had ever run.**
 *
 * There is one CEP extensions folder per Mac and it can point at one checkout.
 * Until Block 11 session 66 the installer repointed an existing link **without
 * a word**, so a second clone — a partner with two, or a rehearsal copy on this
 * machine — silently took the panel away from whatever was using it. Sessions
 * 55, 56 and 65 all declined to run this step for exactly that reason, which is
 * how the one step most likely to go wrong stayed the one step nobody had
 * watched.
 *
 * Every test here drives the real script against a temporary folder standing in
 * for the real one. **The first test proves the stand-in is what the script
 * actually reads** — a fixture the code ignores is the vacuous shape session 57
 * spent a session removing.
 */
const SCRIPT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'scripts',
  'install.mjs',
);
const PANEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REAL = path.join(homedir(), 'Library', 'Application Support', 'Adobe', 'CEP', 'extensions');

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function standIn(): string {
  const d = mkdtempSync(path.join(tmpdir(), 'framopia-cep-'));
  dirs.push(d);
  return d;
}

function run(into: string, args: string[] = []): { status: number; out: string } {
  try {
    const out = execFileSync('node', [SCRIPT, ...args], {
      encoding: 'utf8',
      env: { ...process.env, FRAMOPIA_CEP_EXTENSIONS_DIR: into },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, out };
  } catch (error) {
    const e = error as { status?: number; stdout?: string; stderr?: string };
    return { status: e.status ?? -1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

const linkIn = (dir: string): string => path.join(dir, 'com.framopia.studio');

describe('installing the panel', () => {
  /*
   * The assertion the rest of this file rests on. If the script ignored the
   * override and wrote to the real folder, this would pass vacuously — so it
   * checks the link landed in the stand-in **and** names what the real folder
   * held before and after, which must be the same thing.
   */
  it('really does read the folder it is given, and leaves the real one alone', () => {
    const realBefore = existsSync(REAL)
      ? lstatSync(linkIn(REAL), { throwIfNoEntry: false })?.isSymbolicLink() === true
        ? readlinkSync(linkIn(REAL))
        : '(no link)'
      : '(no extensions folder on this machine)';

    const into = standIn();
    const { status } = run(into);

    expect(status).toBe(0);
    // It landed in the stand-in, which is the only reason the rest is meaningful.
    expect(lstatSync(linkIn(into)).isSymbolicLink()).toBe(true);
    expect(readlinkSync(linkIn(into))).toBe(PANEL);

    const realAfter = existsSync(REAL)
      ? lstatSync(linkIn(REAL), { throwIfNoEntry: false })?.isSymbolicLink() === true
        ? readlinkSync(linkIn(REAL))
        : '(no link)'
      : '(no extensions folder on this machine)';
    expect(realAfter).toBe(realBefore);
  });

  it('says what the folder points at now and what it would point at', () => {
    const { out } = run(standIn());
    expect(out).toContain('it points at    (nothing yet)');
    expect(out).toContain(`it would point at ${PANEL}`);
  });

  it('refuses to take the panel from another checkout, and changes nothing', () => {
    const into = standIn();
    const other = path.join(standIn(), 'another-checkout', 'panel');
    mkdirSync(other, { recursive: true });
    symlinkSync(other, linkIn(into));

    const { status, out } = run(into);

    expect(status).toBe(1);
    expect(out).toContain('REFUSED — this folder already points somewhere else');
    // Nothing was changed: it still points where it did.
    expect(readlinkSync(linkIn(into))).toBe(other);
  });

  it('repoints only when the person says so', () => {
    const into = standIn();
    const other = path.join(standIn(), 'another-checkout', 'panel');
    mkdirSync(other, { recursive: true });
    symlinkSync(other, linkIn(into));

    const { status, out } = run(into, ['--repoint']);

    expect(status).toBe(0);
    expect(readlinkSync(linkIn(into))).toBe(PANEL);
    expect(out).toContain('--repoint was given');
  });

  it('is happy to run twice against the same checkout', () => {
    const into = standIn();
    expect(run(into).status).toBe(0);
    const second = run(into);
    expect(second.status).toBe(0);
    expect(second.out).toContain('already points at');
  });

  it('will not delete a real directory it did not create', () => {
    const into = standIn();
    mkdirSync(linkIn(into), { recursive: true });
    const { status, out } = run(into);
    expect(status).toBe(1);
    expect(out).toContain('is not a symlink');
    expect(lstatSync(linkIn(into)).isDirectory()).toBe(true);
  });
});
