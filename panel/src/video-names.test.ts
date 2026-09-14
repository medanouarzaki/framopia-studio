import { describe, expect, it } from 'vitest';
import { candidatesFor, shortLabel, shortLabels } from './video-names.js';

/** Dr Loubna Kfafi's folder as it really is, read on 2026-09-14. */
const HIS = [
  'August content/Exports/Deliverables/Eyes-Mesotherapy',
  'August content/Exports/Work in Progress/sora',
  'August content/Exports/Work in Progress/test',
  'August content/Footage/Video/MVI_9460',
  'Framopia Studio Inputs/Footages/sora',
  'September Content/Exports/Deliverables/presentative',
  'September Content/Exports/Deliverables/presentative-horizontal',
  'September Content/Exports/Deliverables/vid-2',
  'September Content/Exports/Deliverables/vid-2-2',
  'September Content/Exports/Deliverables/vid-2-3',
  'September Content/Exports/Deliverables/vid-3',
  'September Content/Exports/Deliverables/vid-4',
  'September Content/Exports/Work in Progress/sora',
  'September Content/Exports/Work in Progress/sora-1',
  'September Content/Exports/Work in Progress/sora-2',
  'September Content/Exports/Work in Progress/sora-3',
  'September Content/Exports/Work in Progress/sora-4',
  'September Content/Exports/Work in Progress/sora-5',
  'September Content/Exports/Work in Progress/sora-6',
  'September Content/Footage/Video/MVI_9499',
  'September Content/Footage/Video/MVI_9501',
  'September Content/Footage/Video/MVI_9502',
  'September Content/Footage/Video/MVI_9503',
  'September Content/Footage/Video/MVI_9504',
  'September Content/Footage/Video/MVI_9505',
  'September Content/Footage/Video/MVI_9506',
  'September Content/Footage/Video/MVI_9507',
  'September Content/Footage/Video/MVI_9509',
  'September Content/Footage/Video/MVI_9510',
  'September Content/Footage/Video/MVI_9511',
  'September Content/Footage/Video/MVI_9519',
  'September Content/Footage/Video/MVI_9520',
];

describe('what a video row shows', () => {
  it('shows the name he gave the file when nothing else is called that', () => {
    const shown = shortLabels(HIS);
    expect(shown.get('September Content/Exports/Work in Progress/sora-2')).toBe('sora-2');
    expect(shown.get('September Content/Footage/Video/MVI_9499')).toBe('MVI_9499');
    expect(shown.get('August content/Exports/Work in Progress/test')).toBe('test');
  });

  /**
   * **Three of his files are called `sora.mov`.** Block 12 session 81 is why the
   * stored label carries its folder; this is what a row does about it.
   */
  it('keeps enough folder to tell his three soras apart', () => {
    const shown = shortLabels(HIS);
    expect(shown.get('August content/Exports/Work in Progress/sora')).toBe(
      'August content/…/sora',
    );
    expect(shown.get('September Content/Exports/Work in Progress/sora')).toBe(
      'September Content/…/sora',
    );
    expect(shown.get('Framopia Studio Inputs/Footages/sora')).toBe(
      'Framopia Studio Inputs/…/sora',
    );
  });

  /**
   * **Two videos reading the same is a defect, not a blemish.** This is the
   * property the whole rule exists for, and it is checked against his real
   * folder rather than against an invented one.
   */
  it('never shows two of his videos the same way', () => {
    const shown = [...shortLabels(HIS).values()];
    expect(shown).toHaveLength(HIS.length);
    expect(new Set(shown).size).toBe(HIS.length);
  });

  it('shortens his folder from 44 characters to under 12 on average', () => {
    const shown = [...shortLabels(HIS).values()];
    const before = HIS.reduce((n, l) => n + l.length, 0) / HIS.length;
    const after = shown.reduce((n, s) => n + s.length, 0) / shown.length;
    expect(Math.round(before)).toBe(44);
    expect(after).toBeLessThan(12);
  });

  it('leaves a label with no folder exactly as it is', () => {
    expect(shortLabels(['vitasilk', 'test-1']).get('vitasilk')).toBe('vitasilk');
  });

  it('does not depend on the order they arrive in', () => {
    const forwards = shortLabels(HIS);
    const backwards = shortLabels([...HIS].reverse());
    for (const label of HIS) {
      expect(`${label}: ${backwards.get(label) ?? ''}`).toBe(
        `${label}: ${forwards.get(label) ?? ''}`,
      );
    }
  });

  /*
   * A pair that is identical all the way up: only the whole label separates
   * them, so the whole label is what a row gets. It cannot go further because
   * two labels cannot be equal — the catalogue qualifies every one.
   */
  it('falls back to the whole label when nothing shorter can separate them', () => {
    const shown = shortLabels(['a/b/c/x', 'z/b/c/x']);
    expect(shown.get('a/b/c/x')).toBe('a/…/x');
    expect(shown.get('z/b/c/x')).toBe('z/…/x');
    expect(new Set([...shown.values()]).size).toBe(2);
  });

  it('grows one folder at a time when the first folder is shared', () => {
    const shown = shortLabels(['same/one/x', 'same/two/x']);
    expect(new Set([...shown.values()]).size).toBe(2);
    for (const v of shown.values()) expect(v).not.toBe('x');
  });

  it('offers the shortest first and the whole label last', () => {
    const all = candidatesFor('a/b/c/d');
    expect(all[0]).toBe('d');
    expect(all[all.length - 1]).toBe('a/b/c/d');
  });

  it('shortens one label against a list it is not in', () => {
    expect(shortLabel('September Content/Exports/Work in Progress/sora-2', HIS)).toBe('sora-2');
    expect(shortLabel('somewhere/else/new-one', HIS)).toBe('new-one');
  });
});
