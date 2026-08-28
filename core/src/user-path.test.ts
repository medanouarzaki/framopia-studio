import { afterEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import { resolveUserPath } from './user-path.js';

const saved = process.env['INIT_CWD'];
afterEach(() => {
  if (saved === undefined) delete process.env['INIT_CWD'];
  else process.env['INIT_CWD'] = saved;
});

describe('a path the user typed', () => {
  it('leaves an absolute path alone, spaces and all', () => {
    const p = '/Volumes/T7 Shield/INSEA/my files/test videos/vitasilk.editplan.json';
    expect(resolveUserPath(p)).toBe(p);
  });

  /*
   * The defect: npm runs a workspace script from the workspace, so a relative
   * path typed at the repository root arrived at service/ and did not exist.
   */
  it('resolves a relative path against where the command was run', () => {
    process.env['INIT_CWD'] = '/repo';
    expect(resolveUserPath('my files/test videos/vitasilk.editplan.json')).toBe(
      '/repo/my files/test videos/vitasilk.editplan.json',
    );
  });

  it('falls back to the process directory outside npm', () => {
    delete process.env['INIT_CWD'];
    expect(resolveUserPath('a b.json')).toBe(path.join(process.cwd(), 'a b.json'));
  });
});
