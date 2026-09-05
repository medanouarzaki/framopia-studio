import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  REPO_ROOT,
  loadTemplateManifest,
  modePathFor,
  snapshotOfMode,
  templatesById,
  type AuditComp,
} from '@framopia/core';
import { readEditPlan } from '../editplan/io.js';
import { createClient, deleteClient } from './create.js';
import { resolveClientIdentity } from '../build/client-identity.js';
import { buildReel } from '../build/reel-plan.js';
import { buildChoiceFor } from '../build/choose-candidate.js';
import { textStyleFor } from '../build/text-style.js';

/**
 * **Taking a client off the list must not change a reel already made.**
 *
 * Every reel pins a snapshot of the client at the moment it was analysed and
 * rebuilds from that snapshot forever, so this ought to hold — but "ought to"
 * is what the snapshot exists to replace. The comparison is the built reel
 * itself: every element, every timing, every colour and every face the builder
 * produces, before the client is removed and after.
 *
 * It is not the `.aep` because After Effects embeds a timestamp in a project
 * file and two builds of one comp never have the same bytes — measured in Block
 * 10 session 52 and excluded from the golden census for exactly that reason.
 * What the builder hands to After Effects is deterministic, and it is what
 * decides the comp.
 */
let dir: string | null = null;
const made: string[] = [];

afterEach(() => {
  for (const id of made.splice(0)) rmSync(modePathFor(id), { force: true });
  if (dir !== null) rmSync(dir, { recursive: true, force: true });
  dir = null;
});

describe('a reel already made, after its client is taken off the list', () => {
  it('builds to exactly the same thing, field for field', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'framopia-delete-'));

    const { id } = createClient({
      name: 'Delete Safety Test',
      palette: { background: '#101820', primary: '#2A4A66', accent: '#63C7E8', light: '#F4FAFF' },
      fonts: { latin: 'Inter-SemiBold', arabic: 'Almarai-Bold', emphasis: 'Georgia' },
    });
    made.push(id);

    /*
     * A real corpus plan, pinned to this client the way the analysis stage pins
     * one, so what is compared is a reel that was actually approved as theirs.
     */
    const planPath = path.join(dir, 'a scratch reel.editplan.json');
    const source = path.join(REPO_ROOT, 'my files', 'test videos', 'vitasilk.editplan.json');
    const raw = JSON.parse(readFileSync(source, 'utf8')) as Record<string, unknown>;
    raw['clientMode'] = { id, version: 1, path: modePathFor(id) };
    raw['clientSnapshot'] = snapshotOfMode(
      JSON.parse(readFileSync(modePathFor(id), 'utf8')),
      '2026-09-05T00:00:00.000Z',
    );
    writeFileSync(planPath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');

    const plan = await readEditPlan(planPath);
    const audit = JSON.parse(
      readFileSync(path.join(REPO_ROOT, 'templates', 'library.audit.json'), 'utf8'),
    ) as { comps: AuditComp[] };
    const entries = templatesById(loadTemplateManifest());

    const build = (): unknown => {
      const identity = resolveClientIdentity(plan, {});
      return {
        identity: { snapshot: identity.snapshot, source: identity.source },
        reel: buildReel({
          plan,
          audit: audit.comps,
          cardTemplateId: 'img_float',
          topLeftFor: () => ({ x: 0.03, y: 0.03, w: 0.4, h: 0.4 }),
          introFor: (tid) => entries.get(tid)?.introS ?? 0,
          minHoldFor: (tid) => entries.get(tid)?.minHoldS ?? 0,
          sfxFileFor: (sid) => path.join(REPO_ROOT, 'assets', 'sfx', `${sid}.wav`),
          candidateFileFor: (slotId) => {
            const slot = plan.images.slots.find((s) => s.id === slotId);
            if (slot === undefined) return null;
            const choice = buildChoiceFor(slot);
            const c = slot.candidates.find((x) => x.id === choice.candidateId);
            return c === undefined ? null : { path: c.path, id: c.id };
          },
          textStyleFor: (inputs) =>
            textStyleFor({ ...inputs, snapshot: identity.snapshot }) ?? undefined,
        }),
      };
    };

    const before = JSON.stringify(build());

    const removed = deleteClient(id);
    made.splice(made.indexOf(id), 1);

    const after = JSON.stringify(build());

    expect(after).toBe(before);
    // And it really is gone: the same call on a plan with no pin would throw.
    expect(resolveClientIdentity(plan, {}).source).toBe('plan');
    expect(resolveClientIdentity(plan, {}).behind).toBeNull();

    rmSync(removed.movedTo, { force: true });
  });
});
