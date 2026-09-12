import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { EditPlan, ImageSlot } from '../editplan/types.js';
import {
  fillSlotsFromClientLibrary,
  normaliseIdea,
  readClientLibrary,
} from './client-library.js';

const candidate = (id: string): ImageSlot['candidates'][number] =>
  ({ id, path: `/cache/${id}.jpg`, cutoutPath: `/cut/${id}.png`, cutoutQuality: 0.4 }) as
    ImageSlot['candidates'][number];

const slot = (o: Partial<ImageSlot>): ImageSlot => ({
  id: 'img001',
  wordIds: ['w1'],
  start: 0,
  end: 2,
  contextText: 'c',
  idea: 'A vial of Sculptra aesthetic treatment',
  prompt: 'p',
  negativePrompt: 'n',
  candidates: [],
  chosenCandidateId: null,
  presentation: null,
  zoneId: null,
  templateId: null,
  status: 'pending',
  ...o,
});

/** A plan file on disk, which is what the library actually reads. */
function planFile(dir: string, name: string, clientId: string | null, slots: ImageSlot[]): string {
  const plan = {
    meta: { id: name, createdAt: '', updatedAt: '', appVersion: '0' },
    clientMode: clientId === null ? null : { id: clientId, version: 1, path: '/m.json' },
    images: { slots },
  } as unknown as EditPlan;
  const file = path.join(dir, `${name}.editplan.json`);
  writeFileSync(file, JSON.stringify(plan));
  return file;
}

describe('what counts as the same thing', () => {
  it('ignores case, surrounding space and a trailing full stop', () => {
    expect(normaliseIdea('  A Glowing Vial of serum.  ')).toBe('a glowing vial of serum');
    expect(normaliseIdea('A glowing vial of serum')).toBe(normaliseIdea('a glowing VIAL of serum.'));
  });

  it('collapses runs of whitespace, so a line break is not a different picture', () => {
    expect(normaliseIdea('A vial\n  of serum')).toBe('a vial of serum');
  });

  /**
   * **Two ideas are not the same because they share a word**, and these are the
   * real pairs from Dr Loubna's reels that a looser rule would have joined.
   * `A syringe of dermal filler` and `Hair filler syringe` are different products
   * for different treatments; a rule matching on shared words puts one where the
   * other belongs. Block 12 session 92 measured both.
   */
  it('does not join two ideas that merely share a word', () => {
    expect(normaliseIdea('A syringe of dermal filler')).not.toBe(normaliseIdea('Hair filler syringe'));
    expect(normaliseIdea('Mesotherapy syringe')).not.toBe(
      normaliseIdea('A close-up of a mesotherapy micro-needle device touching skin.'),
    );
  });
});

describe('a client’s store of what has been bought for them', () => {
  it('finds a picture bought on another reel of the same client', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'framopia-library-'));
    const earlier = planFile(dir, 'reel-one', 'her', [
      slot({ candidates: [candidate('img001-c1'), candidate('img001-c2')] }),
    ]);
    const library = readClientLibrary({ clientId: 'her', planPaths: [earlier] });
    expect(library.size).toBe(1);
    expect(library.get(normaliseIdea('a vial of sculptra aesthetic treatment'))?.reel).toBe(
      'reel-one',
    );
    rmSync(dir, { recursive: true, force: true });
  });

  /**
   * **The proof that a picture cannot cross clients, on its own.**
   *
   * Her Sculptra picture is in her brand style and must never appear in K2's
   * reel. The guarantee is structural rather than a filter: the library is read
   * for one client id, so a caller asking as K2 is never handed her entries at
   * all. This asserts it from the outside — same idea, same disk, different
   * client, nothing found.
   */
  it('never hands one client a picture bought for another', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'framopia-library-'));
    const hers = planFile(dir, 'her-reel', 'dr-loubna-kfafi', [
      slot({ candidates: [candidate('img001-c1')] }),
    ]);
    const both = [hers];

    const forHer = readClientLibrary({ clientId: 'dr-loubna-kfafi', planPaths: both });
    expect(forHer.size).toBe(1);

    const forK2 = readClientLibrary({ clientId: 'k2-syndicalia', planPaths: both });
    expect(forK2.size).toBe(0);
    expect([...forK2.keys()]).toEqual([]);

    /* And filling K2's slot from K2's library changes nothing about it. */
    const target = [slot({ id: 'img001' })];
    const out = fillSlotsFromClientLibrary({ slots: target, library: forK2 });
    expect(out.reused).toEqual([]);
    expect(out.slots[0]?.candidates).toEqual([]);
    expect(out.slots[0]?.reusedFrom).toBeUndefined();
    rmSync(dir, { recursive: true, force: true });
  });

  it('does not reuse a reel from itself', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'framopia-library-'));
    const own = planFile(dir, 'reel-one', 'her', [
      slot({ candidates: [candidate('img001-c1')] }),
    ]);
    const library = readClientLibrary({
      clientId: 'her',
      planPaths: [own],
      excludePlanId: 'reel-one',
    });
    expect(library.size).toBe(0);
    rmSync(dir, { recursive: true, force: true });
  });

  /* A photograph of hers is already free and carries no candidates. */
  it('ignores a slot answered from the client’s own photographs', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'framopia-library-'));
    const earlier = planFile(dir, 'reel-one', 'her', [
      slot({ candidates: [candidate('img001-c1')], chosenClientPictureId: 'pic012' }),
    ]);
    expect(readClientLibrary({ clientId: 'her', planPaths: [earlier] }).size).toBe(0);
    rmSync(dir, { recursive: true, force: true });
  });

  it('a plan belonging to nobody is nobody’s store', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'framopia-library-'));
    const orphan = planFile(dir, 'reel-one', null, [
      slot({ candidates: [candidate('img001-c1')] }),
    ]);
    expect(readClientLibrary({ clientId: 'her', planPaths: [orphan] }).size).toBe(0);
    expect(readClientLibrary({ clientId: '', planPaths: [orphan] }).size).toBe(0);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('putting a client’s earlier picture into a new reel', () => {
  const library = (o: Partial<Parameters<typeof fillSlotsFromClientLibrary>[0]> = {}) => o;
  void library;

  const stocked = (chosen: string | null = null) =>
    new Map([
      [
        normaliseIdea('A vial of Sculptra aesthetic treatment'),
        {
          reel: 'reel-one',
          planId: 'reel-one',
          idea: 'A vial of Sculptra aesthetic treatment',
          candidates: [candidate('img004-c1'), candidate('img004-c2')],
          chosenCandidateId: chosen,
        },
      ],
    ]);

  it('fills the slot and says which reel it came from', () => {
    const out = fillSlotsFromClientLibrary({ slots: [slot({})], library: stocked() });
    expect(out.reused.map((r) => r.reel)).toEqual(['reel-one']);
    expect(out.slots[0]?.reusedFrom).toEqual({ reel: 'reel-one', planId: 'reel-one' });
    expect(out.slots[0]?.status).toBe('generated');
  });

  /* Renamed to this slot, so two reels' candidate ids never collide. */
  it('renames the candidates to this slot and charges nothing for them', () => {
    const out = fillSlotsFromClientLibrary({ slots: [slot({ id: 'img007' })], library: stocked() });
    expect(out.slots[0]?.candidates.map((c) => c.id)).toEqual(['img007-c1', 'img007-c2']);
    expect(out.slots[0]?.candidates.map((c) => c.costUsd)).toEqual([0, 0]);
  });

  /*
   * The cutout, its quality, the gate and the text reading were all measured
   * against the reel they were made for. They are free to take again, so they
   * are dropped rather than carried and this reel measures its own.
   */
  it('carries the bought bytes and none of the measurements', () => {
    const out = fillSlotsFromClientLibrary({ slots: [slot({})], library: stocked() });
    expect(out.slots[0]?.candidates[0]?.path).toBe('/cache/img004-c1.jpg');
    expect(out.slots[0]?.candidates[0]?.cutoutPath).toBeNull();
    expect(out.slots[0]?.candidates[0]?.cutoutQuality).toBeNull();
  });

  /**
   * **A candidate he passed over is not reused.** He judges these by eye, and
   * when he has chosen one of two the other is a picture he rejected; putting it
   * into the next reel would be worse than buying a new one.
   */
  it('brings across the candidate he chose, when he chose one', () => {
    const out = fillSlotsFromClientLibrary({
      slots: [slot({})],
      library: stocked('img004-c2'),
    });
    expect(out.slots[0]?.candidates).toHaveLength(1);
    expect(out.slots[0]?.candidates[0]?.path).toBe('/cache/img004-c2.jpg');
  });

  it('leaves a slot whose candidate was chosen by hand exactly as it is', () => {
    const target = slot({ chosenCandidateId: 'img001-c1', candidates: [candidate('img001-c1')] });
    const out = fillSlotsFromClientLibrary({ slots: [target], library: stocked() });
    expect(out.reused).toEqual([]);
    expect(out.slots[0]).toEqual(target);
  });

  it('leaves a slot already answered from her own photographs', () => {
    const target = slot({ chosenClientPictureId: 'pic014' });
    const out = fillSlotsFromClientLibrary({ slots: [target], library: stocked() });
    expect(out.reused).toEqual([]);
    expect(out.slots[0]).toEqual(target);
  });

  it('leaves a slot that already holds pictures bought for this reel', () => {
    const target = slot({ candidates: [candidate('img001-c1')] });
    const out = fillSlotsFromClientLibrary({ slots: [target], library: stocked() });
    expect(out.reused).toEqual([]);
    expect(out.slots[0]?.reusedFrom).toBeUndefined();
  });

  it('leaves a slot naming something else alone', () => {
    const out = fillSlotsFromClientLibrary({
      slots: [slot({ idea: 'Hair filler syringe' })],
      library: stocked(),
    });
    expect(out.reused).toEqual([]);
    expect(out.slots[0]?.candidates).toEqual([]);
  });
});
