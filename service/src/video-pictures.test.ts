import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  CLIENT_PICTURE_STORE,
  REPO_ROOT,
  isInClientPictureStore,
  matchClientPicture,
  type ClientPicture,
} from '@framopia/core';
import { readEditPlan } from './editplan/io.js';
import { videoDirName, videoOf } from './video-identity.js';
import { clientPictureFileFor } from './build/client-picture.js';
import { fillSlotsFromClientPictures } from './analysis/client-picture-slots.js';
import {
  addVideoPicture,
  nextOwnPictureId,
  removeVideoPicture,
  setVideoPictureLabel,
  VideoPictureError,
} from './video-pictures.js';
import type { EditPlan, ImageSlot, PlanWord } from './editplan/types.js';

let dir: string | null = null;

function scratch(): string {
  dir ??= mkdtempSync(path.join(tmpdir(), 'framopia-vidpics-'));
  return dir;
}

const CORPUS_PLAN = path.join(
  process.cwd().replace(/\/service$/, ''),
  'my files',
  'test videos',
  'vitasilk.editplan.json',
);

function still(name: string): string {
  const file = path.join(scratch(), `${name}.png`);
  writeFileSync(file, 'not really a picture');
  return file;
}

/**
 * The store directory the fixture reel owns. Derived the way the code under
 * test derives it, rather than spelled out, so a change to how a video is filed
 * cannot leave copies behind in the project.
 */
function fixtureStoreDir(): string {
  const source = JSON.parse(readFileSync(CORPUS_PLAN, 'utf8')).source as {
    videoPath: string;
    sha256: string;
  };
  return path.join(REPO_ROOT, ...CLIENT_PICTURE_STORE, videoDirName(videoOf(source)));
}

/** A real plan, copied from the corpus so it validates on read exactly as one. */
function planCopy(): string {
  const source = CORPUS_PLAN;
  const copy = path.join(scratch(), 'a scratch reel.editplan.json');
  writeFileSync(copy, readFileSync(source, 'utf8'));
  return copy;
}

afterEach(() => {
  if (dir !== null) rmSync(dir, { recursive: true, force: true });
  dir = null;
  /*
   * A picture attached to a video is copied into the project now, so the copies
   * go the way the scratch plan goes. Every test here works on a copy of the
   * one fixture reel, so the store directory it owns is the only one to clear.
   */
  rmSync(fixtureStoreDir(), { recursive: true, force: true });
});

describe('pictures attached to one video', () => {
  it('is numbered so it can never be mistaken for a client’s', () => {
    // A client's are pic001 upward; a slot records one id for either.
    expect(nextOwnPictureId([])).toBe('own001');
    expect(nextOwnPictureId([{ id: 'own001' } as ClientPicture])).toBe('own002');
  });

  /*
   * **It used to assert the file was not copied.** Mohamed's ruling of
   * 2026-09-05 retires that: a picture attached to a video is copied into the
   * project like a client's, so the reel travels with the repository. What has
   * not changed is that his own file is left exactly where it is.
   */
  it('goes onto the plan with its label, and is copied into the project', async () => {
    const planPath = planCopy();
    const file = still('bottle');
    const picture = await addVideoPicture(planPath, {
      path: file,
      description: 'the bottle for this reel',
      label: 'Zephyrine',
    });
    expect(picture.id).toBe('own001');
    const plan = await readEditPlan(planPath);
    const kept = plan.pictures?.[0];
    expect({ ...kept, path: '<the copy>' }).toEqual({
      id: 'own001',
      path: '<the copy>',
      description: 'the bottle for this reel',
      label: 'Zephyrine',
    });

    // The path on the plan is the copy inside the project, not where he put it.
    expect(isInClientPictureStore(REPO_ROOT, kept?.path as string)).toBe(true);
    expect(kept?.path).not.toBe(file);
    // Filed under the video's own sha256, so two reels called sora.mov cannot meet.
    expect(path.basename(path.dirname(kept?.path as string))).toMatch(/-[0-9a-f]{12}$/);
    // Copied, never moved: his file is still there and still says what it said.
    expect(readFileSync(file, 'utf8')).toBe('not really a picture');
    expect(readFileSync(kept?.path as string, 'utf8')).toBe('not really a picture');
  });

  it('refuses a file that is not there, and a picture nobody described', async () => {
    const planPath = planCopy();
    await expect(
      addVideoPicture(planPath, { path: '/nowhere/at/all.png', description: 'x' }),
    ).rejects.toThrow(VideoPictureError);
    await expect(
      addVideoPicture(planPath, { path: still('x'), description: '  ' }),
    ).rejects.toThrow(/describe the picture/);
  });

  it('changes and clears a label without moving the picture', async () => {
    const planPath = planCopy();
    const added = await addVideoPicture(planPath, {
      path: still('y'),
      description: 'y',
      label: 'first',
    });
    expect((await setVideoPictureLabel(planPath, added.id, 'second')).label).toBe('second');
    expect((await setVideoPictureLabel(planPath, added.id, '')).label).toBeUndefined();
    const plan = await readEditPlan(planPath);
    expect(plan.pictures?.[0]?.id).toBe(added.id);
    expect(plan.pictures?.[0]?.path).toBe(added.path);
  });

  /*
   * A slot naming a picture nothing can resolve is a build that refuses at
   * pre-flight, and the user forgetting a picture is not asking for that.
   */
  it('puts a slot that had chosen it back to being generated', async () => {
    const planPath = planCopy();
    const added = await addVideoPicture(planPath, { path: still('z'), description: 'z' });
    const plan = await readEditPlan(planPath);
    const first = plan.images.slots[0] as ImageSlot;
    plan.images.slots[0] = {
      ...first,
      chosenClientPictureId: added.id,
      chosenClientPictureWord: 'z',
    };
    writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');

    const result = await removeVideoPicture(planPath, added.id);
    expect(result.freedSlots).toEqual([first.id]);
    const after = await readEditPlan(planPath);
    expect(after.pictures).toBeUndefined();
    expect(after.images.slots[0]?.chosenClientPictureId).toBeUndefined();
    expect(after.images.slots[0]?.chosenClientPictureWord).toBeUndefined();
  });
});

function word(id: string, text: string): PlanWord {
  return {
    id, text, sourceText: text, start: 0, end: 1, lang: null, script: 'latin',
    confidence: 1, removed: false, removedReason: null, edited: false,
  };
}

function slot(id: string, wordIds: string[]): ImageSlot {
  return {
    id, wordIds, start: 0, end: 2, contextText: '', idea: 'i', prompt: 'p',
    negativePrompt: 'n', candidates: [], chosenCandidateId: null,
    presentation: null, zoneId: null, templateId: null, status: 'pending',
  } as ImageSlot;
}

/*
 * **What wins, and why.** A picture put on one video is the more specific
 * statement: it was chosen for this reel, while a client's applies to
 * everything they will ever make. The preference is expressed by search order
 * alone — `matchClientPicture` already takes the first picture whose label
 * holds the word — so there is one matching rule and not a second copy of it.
 */
describe('a video’s own picture against the client’s', () => {
  const theirs = [
    { id: 'pic001', path: '/c/theirs.png', description: 'the client’s', label: 'Zephyrine' },
  ];
  const mine = [
    { id: 'own001', path: '/v/mine.png', description: 'this reel’s', label: 'Zephyrine' },
  ];

  it('is the video’s that is used when both labels hold the word', () => {
    const out = fillSlotsFromClientPictures({
      slots: [slot('img001', ['w1'])],
      words: [word('w1', 'Zephyrine')],
      mode: { pictures: theirs },
      ownPictures: mine,
    });
    expect(out.filled).toEqual([{ slotId: 'img001', pictureId: 'own001', word: 'Zephyrine' }]);
  });

  it('is the client’s when only theirs holds the word', () => {
    const out = fillSlotsFromClientPictures({
      slots: [slot('img001', ['w1'])],
      words: [word('w1', 'Zephyrine')],
      mode: { pictures: theirs },
      ownPictures: [{ id: 'own001', path: '/v/o.png', description: 'o', label: 'Kalimba' }],
    });
    expect(out.filled[0]?.pictureId).toBe('pic001');
  });

  /* The preference is the list order, not a rule of its own. */
  it('is the same answer the matcher gives for the two lists joined', () => {
    const spoken = [{ id: 'w1', text: 'Zephyrine' }];
    expect(matchClientPicture([...mine, ...theirs], spoken)?.pictureId).toBe('own001');
    expect(matchClientPicture([...theirs, ...mine], spoken)?.pictureId).toBe('pic001');
  });

  /* It is on the plan, so it resolves without a client at all. */
  it('resolves at build time without needing the client to exist', () => {
    const plan = { clientMode: null, pictures: mine } as unknown as Pick<
      EditPlan,
      'clientMode' | 'pictures'
    >;
    expect(
      clientPictureFileFor(plan, { id: 'img001', chosenClientPictureId: 'own001' }),
    ).toEqual({ path: '/v/mine.png', id: 'own001' });
  });
});
