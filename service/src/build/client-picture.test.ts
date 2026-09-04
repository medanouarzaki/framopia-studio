import { describe, expect, it } from 'vitest';
import { ClientPictureError, clientPictureFileFor } from './client-picture.js';

/*
 * Two clients, both numbering their pictures from `pic001`, both labelling a
 * picture with the same word. That is the ordinary case, not a contrived one:
 * `nextPictureId` starts every client at `pic001`.
 */
const CLIENTS: Record<string, { pictures: { id: string; path: string; description: string }[] }> = {
  hers: { pictures: [{ id: 'pic001', path: '/hers/box.png', description: 'her box' }] },
  his: { pictures: [{ id: 'pic001', path: '/his/clinic.png', description: 'his clinic' }] },
};
const load = (id: string) => CLIENTS[id] ?? { pictures: [] };

const plan = (clientId: string | null) => ({
  clientMode: clientId === null ? null : { id: clientId, version: 1 },
}) as Parameters<typeof clientPictureFileFor>[0];

const slot = (pictureId?: string) => ({ id: 'img001', ...(pictureId === undefined ? {} : { chosenClientPictureId: pictureId }) });

describe('the file behind a slot the client’s own picture fills', () => {
  it('is nothing at all when no picture fills it', () => {
    expect(clientPictureFileFor(plan('hers'), slot(), { load })).toBeNull();
  });

  it('is that client’s picture', () => {
    expect(clientPictureFileFor(plan('hers'), slot('pic001'), { load })).toEqual({
      path: '/hers/box.png',
      id: 'pic001',
    });
  });

  /*
   * Every client numbers from `pic001`, so an id resolved without knowing whose
   * it is lands on somebody else's photograph. `--mode` rebuilds a reel in a
   * different look; it may not change whose pictures it shows.
   */
  it('refuses to resolve one client’s id against another client', () => {
    expect(() =>
      clientPictureFileFor(plan('hers'), slot('pic001'), { overrideModeId: 'his', load }),
    ).toThrow(ClientPictureError);
    try {
      clientPictureFileFor(plan('hers'), slot('pic001'), { overrideModeId: 'his', load });
    } catch (error) {
      expect((error as Error).message).toContain('a different client’s photograph');
    }
  });

  it('allows an override that names the plan’s own client', () => {
    expect(
      clientPictureFileFor(plan('hers'), slot('pic001'), { overrideModeId: 'hers', load })?.path,
    ).toBe('/hers/box.png');
  });

  it('refuses when the plan names a picture and no client', () => {
    expect(() => clientPictureFileFor(plan(null), slot('pic001'), { load })).toThrow(
      /names no client/,
    );
  });

  it('refuses when the picture has been taken off the client', () => {
    expect(() => clientPictureFileFor(plan('hers'), slot('pic404'), { load })).toThrow(
      /not on hers any more/,
    );
  });
});
