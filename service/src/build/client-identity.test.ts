import { describe, expect, it } from 'vitest';
import { snapshotOfMode, type ClientMode, type ClientSnapshot } from '@framopia/core';
import { resolveClientIdentity } from './client-identity.js';
import type { EditPlan } from '../editplan/types.js';

function mode(over: Partial<ClientMode> = {}): ClientMode {
  return {
    id: 'acme',
    name: 'Acme',
    version: 3,
    palette: {
      background: '#000000',
      primary: '#110000',
      accent: '#CCAA66',
      light: '#FFFFFF',
    },
    fonts: { status: 'set', latin: 'Fake Sans', arabic: 'Fake Arabic' },
    imageStyle: { stylePrompt: ['x'], negativePrompt: ['y'] },
    imageVariation: { note: 'n', axes: { a: ['one', 'two'] } },
    allowedTemplates: { subtitle: ['sub_a'], keyword: ['kw_a'], image: ['img_a'] },
    vocabulary: [],
    ...over,
  } as ClientMode;
}

type PlanLike = Pick<EditPlan, 'clientMode' | 'clientSnapshot'>;

function plan(over: Partial<PlanLike> = {}): PlanLike {
  return {
    clientMode: { id: 'acme', version: 3, path: '/modes/acme.json' },
    ...over,
  } as PlanLike;
}

describe('resolveClientIdentity', () => {
  it('reads the copy on the plan, not the client file', () => {
    const pinned = snapshotOfMode(mode(), 'march');
    const identity = resolveClientIdentity(plan({ clientSnapshot: pinned }), {
      loadMode: () => mode({ version: 9, palette: { ...mode().palette, accent: '#FFFFFF' } }),
    });

    expect(identity.source).toBe('plan');
    expect(identity.snapshot?.palette.accent).toBe('#CCAA66');
    expect(identity.note).toContain('as it was saved for this video');
  });

  /*
   * This is the whole decision, stated as a test that could fail: a reel
   * approved against one look must rebuild against that look after the client
   * file changes underneath it. Reading the live mode here — which is what the
   * builder did before — turns every assertion below red.
   */
  it('builds a pinned reel with its own fonts and palette after the client changes', () => {
    const march = snapshotOfMode(mode({ version: 3 }), 'march');
    const june = mode({
      version: 9,
      palette: { background: '#123456', primary: '#654321', accent: '#ABCDEF', light: '#FEDCBA' },
      fonts: { status: 'set', latin: 'June Sans', arabic: 'June Arabic', emphasis: 'June Serif' },
      imageScale: 1.9,
    });

    const identity = resolveClientIdentity(plan({ clientSnapshot: march }), {
      loadMode: () => june,
    });
    const snapshot = identity.snapshot as ClientSnapshot;

    expect(snapshot.version).toBe(3);
    expect(snapshot.palette).toEqual(mode().palette);
    expect(snapshot.fonts).toEqual({ status: 'set', latin: 'Fake Sans', arabic: 'Fake Arabic' });
    expect(snapshot.imageScale).toBe(1);
    // And it is visible that the client has moved on, so nobody has to guess.
    expect(identity.behind).toBe(true);
  });

  it('says nothing has moved while the client is unchanged', () => {
    const identity = resolveClientIdentity(
      plan({ clientSnapshot: snapshotOfMode(mode(), 'march') }),
      { loadMode: () => mode() },
    );
    expect(identity.behind).toBe(false);
  });

  /*
   * A plan written before snapshots existed still builds, exactly as it did —
   * and the fallback is reported rather than assumed, because a build quietly
   * reading a mode file is the failure the copy exists to prevent.
   */
  it('falls back to the client file when a plan has no copy, and says so', () => {
    const identity = resolveClientIdentity(plan(), { loadMode: () => mode({ version: 9 }) });

    expect(identity.source).toBe('live-mode');
    expect(identity.snapshot?.version).toBe(9);
    expect(identity.note).toContain('no saved copy');
    expect(identity.behind).toBeNull();
  });

  it('has no client at all when the plan names none', () => {
    const identity = resolveClientIdentity({ clientMode: null } as PlanLike, {
      loadMode: () => mode(),
    });

    expect(identity.source).toBe('none');
    expect(identity.snapshot).toBeNull();
    expect(identity.note).toContain('template');
  });

  it('lets an explicit --mode win over the copy, and says which it took', () => {
    const identity = resolveClientIdentity(
      plan({ clientSnapshot: snapshotOfMode(mode(), 'march') }),
      { loadMode: () => mode({ version: 9 }), modeIdOverride: 'acme' },
    );

    expect(identity.source).toBe('override');
    expect(identity.snapshot?.version).toBe(9);
    expect(identity.note).toContain('asked for explicitly');
  });

  /*
   * A client file renamed or deleted must not stop a reel building: the copy is
   * still exactly what was approved. There is simply nothing to compare it to.
   */
  it('still builds a pinned reel when the client file has gone', () => {
    const identity = resolveClientIdentity(
      plan({ clientSnapshot: snapshotOfMode(mode(), 'march') }),
      {
        loadMode: () => {
          throw new Error('no such mode');
        },
      },
    );

    expect(identity.source).toBe('plan');
    expect(identity.snapshot?.version).toBe(3);
    expect(identity.behind).toBeNull();
  });
});
