import { afterEach, describe, expect, it, vi } from 'vitest';
import { fileDialogSupport, pickVideoFile } from './file-dialog.js';
import { VIDEO_EXTENSIONS_WITHOUT_DOT } from './video-extensions.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

/*
 * Whether this host has a file dialog is a claim about the host, and stubbing
 * one here proves nothing about After Effects — guidelines §3. What these pin
 * is that the panel **looks** rather than assuming, and behaves correctly on
 * both answers, which is the part that can be tested from outside CEP.
 */
describe('finding out whether the host has a file dialog', () => {
  it('says there is none when nothing is injected, which is every browser', () => {
    const support = fileDialogSupport();
    expect(support.available).toBe(false);
    expect(support.api).toBeNull();
    expect(support.detail).toContain('type or paste a path');
    expect(pickVideoFile('/v')).toBeNull();
  });

  it('finds the newer call when the host has one', () => {
    vi.stubGlobal('cep', { fs: { showOpenDialogEx: () => ({ err: 0, data: ['/v/a.mov'] }) } });
    expect(fileDialogSupport()).toMatchObject({ available: true, api: 'showOpenDialogEx' });
    expect(pickVideoFile('/v')).toBe('/v/a.mov');
  });

  it('falls back to the older one', () => {
    vi.stubGlobal('cep', { fs: { showOpenDialog: () => ({ err: 0, data: ['/v/b.mp4'] }) } });
    expect(fileDialogSupport()).toMatchObject({ available: true, api: 'showOpenDialog' });
    expect(pickVideoFile('/v')).toBe('/v/b.mp4');
  });

  /* A host with `cep.fs` and no dialog is a third answer, not the first. */
  it('says so when the host has cep.fs but no dialog', () => {
    vi.stubGlobal('cep', { fs: {} });
    const support = fileDialogSupport();
    expect(support.available).toBe(false);
    expect(support.detail).toContain('no open dialog');
  });

  it('reads a cancel as choosing nothing, not as a failure', () => {
    vi.stubGlobal('cep', { fs: { showOpenDialogEx: () => ({ err: 2, data: [] }) } });
    expect(pickVideoFile('/v')).toBeNull();
    vi.stubGlobal('cep', { fs: { showOpenDialogEx: () => ({ err: 0, data: [] }) } });
    expect(pickVideoFile('/v')).toBeNull();
  });

  it('survives a dialog that throws', () => {
    vi.stubGlobal('cep', {
      fs: {
        showOpenDialogEx: () => {
          throw new Error('no window server');
        },
      },
    });
    expect(pickVideoFile('/v')).toBeNull();
  });

  it('offers the dialog the formats the video list accepts', () => {
    let asked: string[] | undefined;
    vi.stubGlobal('cep', {
      fs: {
        showOpenDialogEx: (_m: boolean, _d: boolean, _t: string, _p: string, types?: string[]) => {
          asked = types;
          return { err: 0, data: ['/v/a.mov'] };
        },
      },
    });
    pickVideoFile('/v');
    expect(asked).toEqual([...VIDEO_EXTENSIONS_WITHOUT_DOT]);
  });
});
