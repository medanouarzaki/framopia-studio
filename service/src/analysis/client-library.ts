import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { EditPlan, ImageCandidate, ImageSlot } from '../editplan/types.js';

/**
 * **What "the same thing" means, and it is deliberately the narrowest answer.**
 *
 * Two ideas name the same thing when their text is identical once case,
 * surrounding space and a trailing full stop are set aside. Nothing else: no
 * stemming, no shared words, no similarity.
 *
 * **Why that holds for a client this tool has never seen.** The idea is the
 * model's own sentence describing what the picture shows, and it is the exact
 * string the prompt is composed from — everything after it in the prompt is the
 * client's style and a drawn variation. So two identical ideas produce two
 * prompts differing only in camera angle, framing and lighting, which is a
 * difference in how the same subject is photographed. They depict the same
 * thing **by construction of the pipeline**, in any language, for any client.
 * That is a property of how a prompt is built, not an observation about anyone's
 * products.
 *
 * **Why nothing looser.** Block 12 session 92 measured Dr Loubna's four reels
 * for what a looser rule would do. `A syringe of dermal filler` and `Hair filler
 * syringe` share the word *filler* and are different products for different
 * treatments; `Mesotherapy syringe` and `A close-up of a mesotherapy micro-needle
 * device touching skin` share *mesotherapy* and are different instruments. A
 * rule matching on shared words would put a hair-filler syringe where a
 * dermal-filler syringe belongs. **Paying twice is a worse deal; showing the
 * wrong product is a worse reel**, and only one of the two is recoverable.
 *
 * What it misses is real and is the price: `Regenera device` and `The Regenera
 * Activa clinical device used for hair restoration` are the same machine and
 * this will not join them.
 */
export function normaliseIdea(idea: string): string {
  return idea.trim().replace(/\s+/g, ' ').replace(/\.+$/, '').toLowerCase();
}

export interface LibraryEntry {
  /** The reel the picture was bought for, as its plan file is named. */
  reel: string;
  planId: string;
  idea: string;
  candidates: ImageCandidate[];
  chosenCandidateId: string | null;
}

/**
 * Every picture this client has already been charged for, by what it depicts.
 *
 * **Keyed on the client and nothing above it.** A picture bought for Dr Loubna
 * is filed under `dr-loubna-kfafi`, and the only way to reach it is to ask as
 * that client. There is no index spanning clients to read the wrong row out of:
 * a caller asking for one client never holds the others' entries at all.
 */
export function readClientLibrary(options: {
  clientId: string;
  planPaths: readonly string[];
  /** The plan being planned, so a reel never reuses from itself. */
  excludePlanId?: string;
}): Map<string, LibraryEntry> {
  const { clientId, planPaths, excludePlanId } = options;
  const out = new Map<string, LibraryEntry>();
  if (clientId.trim() === '') return out;

  for (const planPath of planPaths) {
    if (!existsSync(planPath)) continue;
    let plan: EditPlan;
    try {
      plan = JSON.parse(readFileSync(planPath, 'utf8')) as EditPlan;
    } catch {
      /* A half-written or hand-edited plan is skipped, never fatal: this is an
       * optimisation, and failing to find a picture only costs money. */
      continue;
    }
    /*
     * The client as the plan itself records it. `clientSnapshot` is the pinned
     * copy taken when the reel was made and is what the reel was actually built
     * against; `clientMode` is the live reference. Either identifies the owner,
     * and a plan carrying neither belongs to nobody and is skipped.
     */
    const owner = plan.clientSnapshot?.id ?? plan.clientMode?.id ?? null;
    if (owner !== clientId) continue;
    if (excludePlanId !== undefined && plan.meta?.id === excludePlanId) continue;

    const reel = path.basename(planPath).replace(/\.editplan\.json$/, '');
    for (const slot of plan.images?.slots ?? []) {
      if (slot.candidates.length === 0) continue;
      /*
       * A photograph of the client's own is not this store's business — it is
       * already free, already matched by label, and carries no candidates.
       */
      if (slot.chosenClientPictureId !== undefined) continue;
      const key = normaliseIdea(slot.idea);
      if (key === '' || out.has(key)) continue;
      out.set(key, {
        reel,
        planId: plan.meta?.id ?? reel,
        idea: slot.idea,
        candidates: slot.candidates,
        chosenCandidateId: slot.chosenCandidateId,
      });
    }
  }
  return out;
}

export interface LibraryReuse {
  slotId: string;
  idea: string;
  /** The reel it was bought for, so the panel can say where it came from. */
  reel: string;
}

/**
 * Puts this client's own earlier pictures into the slots that name them.
 *
 * **Automatic, and never across clients** — Mohamed's ruling of 2026-09-12. The
 * library handed in was read for one client; this function has no way to reach
 * another's, because it is not given one.
 *
 * **A choice a person made is never overwritten**, the same rule as
 * `fillSlotsFromClientPictures`: a slot already answered from the client's
 * photographs, or whose candidate was chosen by hand, is left alone.
 *
 * **The candidate Mohamed chose is the one that comes across**, and when he
 * chose none the whole set does. Reusing a candidate he had passed over would be
 * worse than buying a new one.
 *
 * Derived work is **not** carried: the cutout, its metrics, the gate verdict and
 * the text reading are all measured against the reel they were made for and are
 * free to take again, so they are dropped and this reel's own image stage
 * recomputes them into its own directory. Only the bought bytes travel.
 */
export function fillSlotsFromClientLibrary(options: {
  slots: ImageSlot[];
  library: ReadonlyMap<string, LibraryEntry>;
}): { slots: ImageSlot[]; reused: LibraryReuse[] } {
  const { slots, library } = options;
  if (library.size === 0) return { slots, reused: [] };
  const reused: LibraryReuse[] = [];

  const next = slots.map((slot) => {
    if (slot.chosenClientPictureId !== undefined) return slot;
    if (slot.chosenCandidateId !== null) return slot;
    if (slot.candidates.length > 0) return slot;

    const entry = library.get(normaliseIdea(slot.idea));
    if (entry === undefined) return slot;

    const keep =
      entry.chosenCandidateId === null
        ? entry.candidates
        : entry.candidates.filter((c) => c.id === entry.chosenCandidateId);
    if (keep.length === 0) return slot;

    reused.push({ slotId: slot.id, idea: slot.idea, reel: entry.reel });
    return {
      ...slot,
      candidates: keep.map((candidate, i) => ({
        id: `${slot.id}-c${String(i + 1)}`,
        path: candidate.path,
        cutoutPath: null,
        cutoutQuality: null,
        ...(candidate.modelId === undefined ? {} : { modelId: candidate.modelId }),
        ...(candidate.resolution === undefined ? {} : { resolution: candidate.resolution }),
        /* It was paid for once, on another reel. It is not paid for here. */
        costUsd: 0,
      })),
      chosenCandidateId: null,
      status: 'generated' as const,
      reusedFrom: { reel: entry.reel, planId: entry.planId },
    };
  });

  return { slots: next, reused };
}
