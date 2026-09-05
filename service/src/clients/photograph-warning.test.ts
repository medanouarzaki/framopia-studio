import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CLIENT_PICTURE_STORE, REPO_ROOT, loadMode, modePathFor } from '@framopia/core';
import { listModes } from '../catalogue.js';
import { addPicture, createClient } from './create.js';
import { imagesViewForPlan } from '../image-view.js';

/**
 * **The route the warning exists for, driven end to end.**
 *
 * Block 11 session 58 proved a generated picture can never be enlarged — 2048 px
 * arrives and 2030 px is the largest box the frame allows — so the only way a
 * picture is ever stretched is a client's own photograph, or one attached to a
 * single reel. Session 59 built the warning and proved it in the candidate
 * picker, **which is the one route where the defect is unreachable**, and its
 * panel tests set `enlargement` on the fixture by hand: they proved the panel
 * renders the sentence, not that the service works it out for a photograph.
 *
 * This drives the real thing: a client made through `createClient`, a
 * photograph attached through `addPicture`, a real corpus plan pinned to that
 * client with the photograph chosen for a slot, and the view the panel actually
 * reads.
 *
 * **Both fixture photographs are shrunk from a picture this project already
 * paid for** — `vitasilk`'s `img002-c1` — and live in `panel/fixtures/`. Nothing
 * is generated and nothing is a throwaway in `/private/tmp`, where session 53's
 * scratch pictures sit waiting for a reboot to sweep them.
 */
const SMALL = path.join(REPO_ROOT, 'panel', 'fixtures', 'client-photo-small.png');
const LARGE = path.join(REPO_ROOT, 'panel', 'fixtures', 'client-photo-large.png');
const CORPUS_PLAN = path.join(REPO_ROOT, 'my files', 'test videos', 'vitasilk.editplan.json');

const made: string[] = [];
const dirs: string[] = [];

afterEach(() => {
  const kept = [...made];
  for (const id of made.splice(0)) rmSync(modePathFor(id), { force: true });
  // A client's photographs are copied into the project now, so the copies go
  // with the mode file. Built from the one declaration, never spelled out.
  for (const id of kept.splice(0))
    rmSync(path.join(REPO_ROOT, ...CLIENT_PICTURE_STORE, id), { recursive: true, force: true });
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A client with the two photographs on it, through the routes the panel uses. */
function clientWithPhotographs(name: string): string {
  const { id } = createClient({ name });
  made.push(id);
  addPicture(id, { path: SMALL, description: 'the small one', label: 'Zephyrine' });
  addPicture(id, { path: LARGE, description: 'the big one', label: 'Kalimba' });
  return id;
}

/**
 * A real plan, pinned to that client, with the photographs chosen for slots.
 *
 * Written into a temporary directory rather than beside the corpus video: the
 * corpus plans are the reference `npm run golden` compares against, and a test
 * that edited one would move it.
 */
function planChoosing(clientId: string, choices: Record<number, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'framopia-photo-warning-'));
  dirs.push(dir);
  const plan = JSON.parse(readFileSync(CORPUS_PLAN, 'utf8')) as {
    clientMode: unknown;
    images: { slots: Record<string, unknown>[] };
  };
  plan.clientMode = { id: clientId, version: 1, path: modePathFor(clientId) };
  for (const [index, pictureId] of Object.entries(choices)) {
    const slot = plan.images.slots[Number(index)] as Record<string, unknown>;
    slot['chosenClientPictureId'] = pictureId;
  }
  const file = path.join(dir, 'a reel with photographs.editplan.json');
  writeFileSync(file, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
  return file;
}

describe('a client’s own photograph, too small for the space', () => {
  it('is measured by the view the panel reads, not only by the builder', async () => {
    const id = clientWithPhotographs('Photograph Warning Small');
    const view = await imagesViewForPlan(planChoosing(id, { 0: 'pic001' }));

    const slot = view.slots[0];
    expect(slot?.enlargement, 'the view said nothing about the photograph').not.toBeNull();
    // 320px into the audited 1000px box.
    expect(slot?.enlargement?.percent).toBeCloseTo(312.5, 6);
    expect(slot?.enlargement?.tooEnlarged).toBe(true);
  });

  /*
   * 600px is still an enlargement — 166.7% — and is still silent. This is the
   * boundary rather than "any enlargement", which is the whole of the ruling.
   */
  it('says nothing about a photograph that is big enough, though still enlarged', async () => {
    const id = clientWithPhotographs('Photograph Warning Large');
    const view = await imagesViewForPlan(planChoosing(id, { 1: 'pic002' }));

    const slot = view.slots[1];
    expect(slot?.enlargement?.percent).toBeCloseTo(166.6667, 3);
    expect(slot?.enlargement?.percent).toBeGreaterThan(100);
    expect(slot?.enlargement?.tooEnlarged).toBe(false);
  });

  /*
   * The generated candidates on the same reel are 2048px squares and must go on
   * being silent — the warning has to be about the photograph and not about
   * every slot beside it.
   */
  it('leaves the generated slots on the same reel alone', async () => {
    const id = clientWithPhotographs('Photograph Warning Mixed');
    const view = await imagesViewForPlan(planChoosing(id, { 0: 'pic001' }));

    const warned = view.slots.filter((s) => s.enlargement?.tooEnlarged === true);
    expect(warned.map((s) => s.id)).toEqual([view.slots[0]?.id]);
    for (const slot of view.slots.slice(1)) {
      expect(`${slot.id}: ${slot.enlargement?.percent.toFixed(2)}`).toBe(`${slot.id}: 48.83`);
    }
  });

  /* A photograph the client no longer has is the build's refusal to make, not
     this view's — it says nothing rather than failing. */
  it('says nothing when the picture is not on the client any more', async () => {
    const id = clientWithPhotographs('Photograph Warning Gone');
    const view = await imagesViewForPlan(planChoosing(id, { 0: 'pic404' }));
    expect(view.slots[0]?.enlargement).toBeNull();
  });
});

/**
 * **A photograph on a drive this Mac cannot see.**
 *
 * Block 11 session 60 measured what happened: `loadMode` ok, `validateMode`
 * `[]`, the panel handed the dead path, and only pre-flight refusing at build
 * time. The catalogue now answers the question with the picture, so the panel
 * can say it before any button that spends money.
 */
describe('whether a photograph is on this machine', () => {
  it('says so for one that is, and for one that is not', () => {
    const { id } = createClient({ name: 'Photograph Reachable Test' });
    made.push(id);
    addPicture(id, { path: SMALL, description: 'the one that is here' });

    // Written straight onto the file: `addPicture` refuses a path that is not
    // on disk, which is right for attaching and is exactly why a client made on
    // another machine is the case that has to be constructed rather than added.
    const modePath = modePathFor(id);
    const raw = JSON.parse(readFileSync(modePath, 'utf8')) as {
      pictures: { id: string; path: string; description: string }[];
    };
    raw.pictures.push({
      id: 'pic002',
      path: '/Volumes/Some Other Drive/clients/k2/clinic.png',
      description: 'the one on the other drive',
    });
    writeFileSync(modePath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');

    const shown = listModes().find((m) => m.id === id)?.pictures ?? [];
    expect(shown.map((p) => `${p.id}: ${p.onThisMachine}`)).toEqual([
      'pic001: true',
      'pic002: false',
    ]);
  });

  /* It does not refuse and it does not forget: the picture stays on the client. */
  it('keeps the picture on the client either way', () => {
    const { id } = createClient({ name: 'Photograph Reachable Kept' });
    made.push(id);
    const modePath = modePathFor(id);
    const raw = JSON.parse(readFileSync(modePath, 'utf8')) as Record<string, unknown>;
    raw['pictures'] = [
      { id: 'pic001', path: '/Volumes/Some Other Drive/x.png', description: 'gone for now' },
    ];
    writeFileSync(modePath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');

    expect(loadMode(id).pictures).toHaveLength(1);
    expect(listModes().find((m) => m.id === id)?.pictures).toHaveLength(1);
  });
});
