import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { REPO_ROOT } from './paths.js';
import { parseMode, resolveModePaths, type ClientMode } from './mode.js';
import { readFileSync } from 'node:fs';

/**
 * **A client file made on one machine, read on another.**
 *
 * Block 11 session 60 measured the gap: `resolvePlanPaths` re-roots the
 * footage, the plans and every generated candidate, and nothing touched
 * `modes/*.json`. A photograph written on the T7 Shield stayed written on the
 * T7 Shield, and on a Mac without that drive `loadMode` returned ok,
 * `validateMode` returned `[]`, and the panel drew nothing with no explanation
 * until a build refused.
 *
 * The fix is `resolveStoredPath`, the resolver the plans already use — not a
 * second mechanism, and nothing is copied or moved.
 */
const OTHER_MACHINE = '/Volumes/Someone Elses Drive/work/framopia-studio';

function client(over: Partial<ClientMode> = {}): ClientMode {
  return {
    id: 'a-client',
    name: 'A Client',
    version: 1,
    palette: { background: '#000000', primary: '#111111', accent: '#222222', light: '#FFFFFF' },
    fonts: { status: 'tbd', note: 'none yet' },
    imageStyle: { stylePrompt: [], negativePrompt: [] },
    imageVariation: { note: '', axes: {} },
    allowedTemplates: { subtitle: [], keyword: [], image: [] },
    vocabulary: [],
    ...over,
  } as ClientMode;
}

describe('a photograph written on another machine', () => {
  /*
   * The half that is the fix. A photograph kept inside the project — under
   * `my files/`, say — is re-rooted onto the repository running now, so the
   * partner's copy finds the same picture at their own path.
   */
  it('resolves to the right picture where the drive does not exist', () => {
    const stored = path.join(OTHER_MACHINE, 'my files', 'photos', 'clinic.png');
    const resolved = resolveModePaths(
      client({ pictures: [{ id: 'pic001', path: stored, description: 'the clinic' }] }),
    );
    expect(resolved.pictures?.[0]?.path).toBe(
      path.join(REPO_ROOT, 'my files', 'photos', 'clinic.png'),
    );
  });

  /*
   * The half that is the honesty. A photograph genuinely outside any repository
   * is **not** this project's to move, so the path comes back exactly as it was
   * — and whether the bytes are there is a separate question, answered where
   * the pictures are shown.
   */
  it('leaves a photograph that lives outside the project exactly where it is', () => {
    const stored = '/Volumes/Some Other Drive/clients/k2/clinic.png';
    const resolved = resolveModePaths(
      client({ pictures: [{ id: 'pic001', path: stored, description: 'the clinic' }] }),
    );
    expect(resolved.pictures?.[0]?.path).toBe(stored);
  });

  /* Nobody re-attaches a photograph because of this change. */
  it('leaves a path stored the old way, on this machine, untouched', () => {
    const stored = path.join(REPO_ROOT, 'panel', 'fixtures', 'client-photo-small.png');
    const resolved = resolveModePaths(
      client({ pictures: [{ id: 'pic001', path: stored, description: 'the small one' }] }),
    );
    expect(resolved.pictures?.[0]?.path).toBe(stored);
  });

  it('re-roots the logo by the same rule', () => {
    const resolved = resolveModePaths(
      client({ logoPath: path.join(OTHER_MACHINE, 'assets', 'brand', 'logo.png') }),
    );
    expect(resolved.logoPath).toBe(path.join(REPO_ROOT, 'assets', 'brand', 'logo.png'));
  });

  it('says nothing about a client with no pictures and no logo', () => {
    const resolved = resolveModePaths(client());
    expect(resolved.pictures).toBeUndefined();
    expect(resolved.logoPath).toBeUndefined();
  });

  /* The door every reader comes through, so nothing has to remember to call it. */
  it('is applied by parseMode, which is how every reader loads a client', () => {
    const stored = path.join(OTHER_MACHINE, 'my files', 'photos', 'clinic.png');
    const raw = readFileSync(path.join(REPO_ROOT, 'modes', 'k2-syndicalia.json'), 'utf8');
    const asJson = JSON.parse(raw) as ClientMode;
    asJson.pictures = [{ id: 'pic001', path: stored, description: 'the clinic' }];
    const parsed = parseMode(JSON.stringify(asJson), path.join(REPO_ROOT, 'modes', 'k2-syndicalia.json'));
    expect(parsed.pictures?.[0]?.path).toBe(
      path.join(REPO_ROOT, 'my files', 'photos', 'clinic.png'),
    );
  });
});
