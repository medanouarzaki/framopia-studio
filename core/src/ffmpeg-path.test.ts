import { describe, expect, it } from 'vitest';
import { describeFfmpegFailure, resolveFfmpegPath, FFMPEG_SEARCH_DIRS } from './ffmpeg-path.js';

const DIRS = ['/opt/homebrew/bin', '/usr/local/bin'];

function fsWith(present: Record<string, string | true>): {
  existsSync: (p: string) => boolean;
  readFileSync: (p: string, enc: string) => string;
} {
  return {
    existsSync: (p) => Object.prototype.hasOwnProperty.call(present, p),
    readFileSync: (p) => {
      const v = present[p];
      if (typeof v !== 'string') throw new Error(`no content for ${p}`);
      return v;
    },
  };
}

const resolve = (tool: 'ffmpeg' | 'ffprobe', present: Record<string, string | true>) =>
  resolveFfmpegPath(tool, { repo: '/repo', fs: fsWith(present), searchDirs: DIRS });

describe('resolveFfmpegPath', () => {
  it('prefers an explicit path from .local/config.json', () => {
    const r = resolve('ffmpeg', {
      '/repo/.local/config.json': JSON.stringify({ ffmpegPath: '/custom/ffmpeg' }),
      '/custom/ffmpeg': true,
      '/opt/homebrew/bin/ffmpeg': true,
    });
    expect(r.path).toBe('/custom/ffmpeg');
    expect(r.source).toBe('config');
    expect(r.verified).toBe(true);
  });

  it('resolves each tool independently', () => {
    const present = { '/opt/homebrew/bin/ffprobe': true } as Record<string, string | true>;
    expect(resolve('ffprobe', present).source).toBe('homebrew');
    expect(resolve('ffmpeg', present).source).toBe('path');
  });

  it('finds homebrew before /usr/local', () => {
    const r = resolve('ffmpeg', { '/opt/homebrew/bin/ffmpeg': true, '/usr/local/bin/ffmpeg': true });
    expect(r.path).toBe('/opt/homebrew/bin/ffmpeg');
    expect(r.source).toBe('homebrew');
  });

  it('falls back to /usr/local when homebrew has nothing', () => {
    const r = resolve('ffmpeg', { '/usr/local/bin/ffmpeg': true });
    expect(r.path).toBe('/usr/local/bin/ffmpeg');
    expect(r.source).toBe('usr-local');
  });

  /*
   * PATH is last rather than absent: a machine that installs ffmpeg elsewhere
   * and puts it on the path is working, and refusing it would be worse than
   * trying it. `verified` is what says which case this is.
   */
  it('leaves the bare name to PATH when nothing is found, and says it is unverified', () => {
    const r = resolve('ffmpeg', {});
    expect(r.path).toBe('ffmpeg');
    expect(r.source).toBe('path');
    expect(r.verified).toBe(false);
  });

  it('names every candidate it tried', () => {
    const r = resolve('ffmpeg', {});
    expect(r.tried).toEqual([
      '/opt/homebrew/bin/ffmpeg: does not exist',
      '/usr/local/bin/ffmpeg: does not exist',
    ]);
  });

  it('reports a configured path that does not exist rather than skipping it', () => {
    const r = resolve('ffmpeg', {
      '/repo/.local/config.json': JSON.stringify({ ffmpegPath: '/gone/ffmpeg' }),
    });
    expect(r.tried[0]).toContain('/gone/ffmpeg');
    expect(r.tried[0]).toContain('ffmpegPath');
    expect(r.source).not.toBe('config');
  });

  it('survives a config file that is not valid JSON', () => {
    const r = resolve('ffmpeg', { '/repo/.local/config.json': '{ not json' });
    expect(r.source).toBe('path');
    expect(r.tried.some((t) => t.includes('not valid JSON'))).toBe(true);
  });

  it('explains what to do when nothing resolves', () => {
    const message = describeFfmpegFailure(resolve('ffprobe', {}));
    expect(message).toContain('ffprobePath');
    expect(message).toContain('.local/config.json');
    expect(message).toContain('Finder-launched');
  });

  it('searches homebrew and /usr/local by default, in that order', () => {
    expect([...FFMPEG_SEARCH_DIRS]).toEqual(['/opt/homebrew/bin', '/usr/local/bin']);
  });
});

/**
 * Against the real machine: the resolver must agree with the shell, or the
 * panel and a terminal are running different binaries — which is exactly the
 * defect this replaces.
 */
describe('on this machine', () => {
  it('resolves both tools to an absolute path that exists', () => {
    for (const tool of ['ffmpeg', 'ffprobe'] as const) {
      const r = resolveFfmpegPath(tool);
      expect(r.verified, `${tool}: ${r.tried.join('; ')}`).toBe(true);
      expect(r.path.startsWith('/')).toBe(true);
    }
  });
});
