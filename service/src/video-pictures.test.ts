import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { matchClientPicture, type ClientPicture } from '@framopia/core';
import { readEditPlan } from './editplan/io.js';
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

function still(name: string): string {
  const file = path.join(scratch(), `${name}.png`);
  writeFileSync(file, 'not really a picture');
  return file;
}

/** A real plan, copied from the corpus so it validates on read exactly as one. */
function planCopy(): string {
  const source = path.join(
    process.cwd().replace(/\/service$/, ''),
    'my files',
    'test videos',
    'vitasilk.editplan.json',
  );
  const copy = path.join(scratch(), 'a scratch reel.editplan.json');
  writeFileSync(copy, readFileSync(source, 'utf8'));
  return copy;
}

afterEach(() => {
  if (dir !== null) rmSync(dir, { recursive: true, force: true });
  dir = null;
});

describe('pictures attached to one video', () => {
  it('is numbered so it can never be mistaken for a client’s', () => {
    // A client's are pic001 upward; a slot records one id for either.
    expect(nextOwnPictureId([])).toBe('own001');
    expect(nextOwnPictureId([{ id: 'own001' } as ClientPicture])).toBe('own002');
  });

  it('goes onto the plan with its label, and the file is not copied', async () => {
    const planPath = planCopy();
    const file = still('bottle');
    const picture = await addVideoPicture(planPath, {
      path: file,
      description: 'the bottle for this reel',
      label: 'Zephyrine',
    });
    expect(picture.id).toBe('own001');
    const plan = await readEditPlan(planPath);
    expect(plan.pictures?.[0]).toEqual({
      id: 'own001',
      path: file,
      description: 'the bottle for this reel',
      label: 'Zephyrine',
    });
    // The path on the plan is the file where he put it; nothing copied it.
    expect(plan.pictures?.[0]?.path).toBe(file);
    expect(readFileSync(file, 'utf8')).toBe('not really a picture');
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
