import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';
import { BACKUP_GROUPS, humanBytes, surveyGroups } from './set.js';

/*
 * Against the real disk, not a fixture: the whole point of this module is which
 * files on this machine cannot be got back, and a fixture would test the shape
 * while saying nothing about the set.
 */
describe('the irreplaceable set', () => {
  const groups = surveyGroups();
  const by = (id: string) => groups.find((g) => g.id === id);

  it('finds every transcription cache entry, across every video', () => {
    const files = by('transcription-cache')?.paths ?? [];
    const manifests = files.filter((f) => f.endsWith('manifest.json'));
    /*
     * **At least eleven**, not exactly: the five corpus reels hold eleven
     * entries — vitasilk three prompt versions and the other four two each —
     * and every video the user transcribes afterwards adds its own. This
     * asserted the exact number and went red the first time he ran one of his
     * own client reels, which is a test about the machine rather than about the
     * backup set.
     */
    expect(manifests.length).toBeGreaterThanOrEqual(11);
    expect(files.every((f) => f.includes(path.join('.local', 'cache')))).toBe(true);
  });

  /*
   * These were the finding: a person transcribed four reels by ear, the result
   * is the WER baseline for the project, and `.local/` is gitignored — so this
   * disk was the only copy and nothing had ever said so.
   */
  it('includes the hand-written ground truth, which git does not hold', () => {
    const group = by('ground-truth');
    expect(group?.inGit).toBe(false);
    expect(group?.paths.filter((f) => f.endsWith('.txt'))).toHaveLength(4);
  });

  it('includes the hand-made references, and says git already has them', () => {
    const group = by('align-references');
    expect(group?.inGit).toBe(true);
    expect(group?.paths.some((f) => f.endsWith('vitasilk.json'))).toBe(true);
  });

  it('includes the ledger, the plans and the config', () => {
    expect(by('ledger')?.paths).toEqual([path.join(REPO_ROOT, '.local', 'costs.jsonl')]);
    expect(by('plans')?.paths.filter((f) => f.endsWith('.editplan.json'))).toHaveLength(5);
    expect(by('config')?.paths).toHaveLength(existsSync(path.join(REPO_ROOT, '.local', 'config.json')) ? 1 : 0);
  });

  /* Twelve gigabytes changes the answer to "how long will this take". */
  it('leaves the source video out unless it is asked for', () => {
    expect(by('footage')?.optIn).toBe(true);
    expect(BACKUP_GROUPS.filter((g) => g.optIn === true).map((g) => g.id)).toEqual(['footage']);
  });

  /*
   * Frames and masks are 598 MB and regenerate bit-identically for nothing
   * (measured in Block 5), so they are not in the set. If that ever stops being
   * true this test is where it should be reconsidered.
   */
  it('leaves out what regenerates for free', () => {
    const all = groups.flatMap((g) => g.paths);
    expect(all.some((f) => f.includes(path.join('.local', 'cv')))).toBe(false);
    expect(all.some((f) => f.includes(path.join('.local', 'audio')))).toBe(false);
    expect(all.some((f) => f.endsWith('.aep'))).toBe(false);
  });

  it('says how each group could be recovered, or that it cannot be', () => {
    for (const group of BACKUP_GROUPS) {
      expect(group.recovery.length).toBeGreaterThan(20);
    }
    // The four that fail the test outright say so in the same words.
    const cannot = BACKUP_GROUPS.filter((g) => g.recovery.startsWith('CANNOT')).map((g) => g.id);
    expect(cannot).toEqual([
      'transcription-cache', 'analysis-cache', 'ground-truth',
      'align-references', 'ledger', 'plans', 'footage',
    ]);
  });

  it('reads a size a person can act on', () => {
    expect(humanBytes(1023)).toBe('1023 bytes');
    expect(humanBytes(2 * 1024 ** 2)).toBe('2.0 MB');
    expect(humanBytes(3 * 1024 ** 3)).toBe('3.0 GB');
  });
});
