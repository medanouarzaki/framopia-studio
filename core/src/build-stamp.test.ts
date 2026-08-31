import { describe, expect, it } from 'vitest';
import {
  compareBuildStamps,
  describeBuildStamps,
  REBUILD_COMMAND,
  repairFor,
} from './build-stamp.js';

/**
 * The rule both sides read. The panel decides what to show from it and the
 * service declares the field's shape against it, so it is pinned once here
 * rather than twice in two workspaces that could drift.
 */
describe('compareBuildStamps', () => {
  it('says nothing when the two were built from the same code', () => {
    const stamp = 'abc1234567+0011223344556677';
    expect(compareBuildStamps(stamp, stamp)).toEqual({ verdict: 'match', detail: null });
  });

  /*
   * The case the clock comparison got wrong: a service that started long before
   * the panel was built, running exactly the same code. Nothing to say.
   */
  it('does not care which started first', () => {
    const stamp = 'abc1234567+0011223344556677';
    expect(compareBuildStamps(stamp, stamp).verdict).toBe('match');
  });

  /*
   * The commit moves when nothing about the code does — committing a report is
   * enough. Comparing the whole stamp made two artifacts built from identical
   * source compare unequal, which is the false alarm this check replaced.
   */
  it('ignores the commit and compares the code', () => {
    const compared = compareBuildStamps('aaaaaaaaaa+0011223344556677', 'bbbbbbbbbb+0011223344556677');

    expect(compared.verdict).toBe('match');
    expect(compared.detail).toBeNull();
  });

  it('says the code is the same when only the commit differs', () => {
    const said = describeBuildStamps('aaaaaaaaaa+00112233', 'bbbbbbbbbb+00112233');

    expect(said).toContain('same code as this panel');
    expect(said).toContain('different commits');
  });

  it('names a service genuinely one build behind, and says it is being fixed', () => {
    const compared = compareBuildStamps('abc1234567+aaaa', 'abc1234567+bbbb');

    expect(compared.verdict).toBe('different');
    expect(compared.detail).toContain('built from different code');
    expect(compared.detail).toContain('Restarting it now');
  });

  it('never tells a motion designer to type a command', () => {
    // The panel repairs this itself. A message naming a command was the whole
    // defect: the detection was right every time and the remedy was a terminal.
    const compared = compareBuildStamps('abc1234567+aaaa', 'abc1234567+bbbb');
    expect(compared.detail).not.toContain(REBUILD_COMMAND);
    expect(compared.detail).not.toContain('npm run');
    expect(compared.detail).not.toContain('terminal');
  });

  /*
   * The same commit with a dirty tree is a different build, and the content
   * hash is the half that notices. A sha-only stamp would call these equal.
   */
  it('notices a change that never reached a commit', () => {
    expect(compareBuildStamps('abc1234567+aaaa', 'abc1234567+cccc').verdict).toBe('different');
  });

  /*
   * Behind, unknown and down are three states. A service too old to carry a
   * stamp is one this panel cannot tell about — accusing it would send the user
   * to rebuild something that may be perfectly current.
   */
  it('is unknown, never stale, when the service cannot say', () => {
    for (const missing of [null, undefined, '']) {
      const compared = compareBuildStamps('abc1234567+aaaa', missing);
      expect(compared.verdict).toBe('unknown');
      expect(compared.detail).toBeNull();
    }
  });

  it('is unknown when the panel itself cannot say', () => {
    expect(compareBuildStamps(null, 'abc1234567+aaaa').verdict).toBe('unknown');
    expect(compareBuildStamps('', 'abc1234567+aaaa').verdict).toBe('unknown');
  });
});

describe('describeBuildStamps', () => {
  it('says so out loud even when the two agree', () => {
    const stamp = 'abc1234567+aaaa';
    expect(describeBuildStamps(stamp, stamp)).toContain('same build as this panel');
    expect(describeBuildStamps(stamp, stamp)).toContain(stamp);
  });

  it('names both stamps when they differ', () => {
    const said = describeBuildStamps('panel1+aaaa', 'svc1+bbbb');
    expect(said).toContain('panel1+aaaa');
    expect(said).toContain('svc1+bbbb');
  });

  it('distinguishes which side could not say', () => {
    expect(describeBuildStamps(null, 'svc1+bbbb')).toContain('this panel does not say');
    expect(describeBuildStamps('panel1+aaaa', null)).toContain('this service does not say');
  });
});

/*
 * The remedy has to be one that works. `npm run service` exits 1 when a service
 * is already running — `service.ts` refuses a live lock — and this message is
 * only ever printed while one is running, so it has to carry --force.
 */
describe('the remedy', () => {
  it('takes over the running service rather than colliding with it', () => {
    // Kept because the repair does the same thing the command did; it is no
    // longer shown to anyone.
    expect(REBUILD_COMMAND).toBe('npm run service -- --force');
  });
});

describe('what a mismatch actually needs', () => {
  /*
   * The panel's stamp is baked into its bundle; the service reads its own once
   * at startup out of `service/dist/build-stamp.json`. So a restart helps only
   * when that compiled file already agrees with the panel.
   */
  it('restarts when the compiled service already matches the panel', () => {
    expect(repairFor('abc1234567+aaaa', 'zzz9999999+aaaa')).toBe('restart');
  });

  it('rebuilds when the compiled service is itself behind', () => {
    // The ordinary case after `npm run check`, which rebuilds the panel bundle
    // and never touches service/dist.
    expect(repairFor('abc1234567+aaaa', 'abc1234567+bbbb')).toBe('rebuild');
  });

  it('concludes nothing when a stamp is missing', () => {
    expect(repairFor(null, 'abc1234567+aaaa')).toBe('unknown');
    expect(repairFor('abc1234567+aaaa', null)).toBe('unknown');
    expect(repairFor('abc1234567+aaaa', undefined)).toBe('unknown');
    expect(repairFor('', '')).toBe('unknown');
  });
});
