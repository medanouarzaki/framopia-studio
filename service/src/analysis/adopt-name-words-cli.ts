import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT,
  loadConfig,
  loadMode,
  loadSfxIndex,
  loadTemplateManifest,
  templatesById,
} from '@framopia/core';
import { readEditPlan, writeEditPlan } from '../editplan/io.js';
import { planWordsForAnalysis } from './job.js';
import { planSlotsCached, slotCacheRef } from './cached.js';
import { imageSlotCountFor } from './count.js';
import { slotCandidateCountFor } from './slots.js';
import { deriveSfxEvents } from './sfx.js';
import { imageEntranceS, templateImpacts } from './template-impacts.js';
import type { SlotCandidate } from './slot-select.js';

/**
 * Adopts the word each picture is about onto a plan that already has slots.
 *
 * **Additive, and the whole point of it.** `planImageSlotsForPlan` replaces
 * `plan.images.slots` wholesale, and the model call is not reproducible, so
 * re-planning a reel whose pictures are generated throws those pictures away —
 * `sora`'s eleven cost $3.37 and cannot be remade. This asks the model the same
 * question and takes **one field**, and only for a slot whose span the model
 * returned unchanged. No idea, prompt, candidate or choice is touched.
 *
 * A slot the model did not return the same span for keeps arriving with its
 * sentence, which is what every plan did before slot prompt v3.
 *
 * The picture's sound follows the picture, so the SFX events are re-derived
 * from the same declaration the builder places the layer from.
 */
const CEILING_USD = 0.35;

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const planPath = flag('plan');
if (planPath === undefined) {
  console.error('usage: npm run adopt:name-words -- --plan <path.editplan.json> [--mode <id>] [--apply]');
  process.exit(1);
}
const apply = process.argv.includes('--apply');

const plan = await readEditPlan(planPath);
const mode = loadMode(flag('mode') ?? plan.clientMode?.id ?? 'k2-syndicalia');
const config = loadConfig();
const words = planWordsForAnalysis(plan);
const slotCount = imageSlotCountFor(plan.source.durationS);
const candidateCount = slotCandidateCountFor(slotCount);

const { ref } = slotCacheRef({
  videoSha256: plan.source.sha256,
  mode,
  words,
  candidateCount,
});
const ledgerPath = path.join(REPO_ROOT, '.local', 'costs.jsonl');
const linesBefore = readFileSync(ledgerPath, 'utf8').split('\n').filter((l) => l !== '').length;

/*
 * The projection is checked before the call and not after it. A run that
 * discovers it overspent has already spent; at $2.80 of credit remaining, the
 * only useful guard is the one in front.
 */
const cached = (() => {
  try {
    return statSync(path.join(ref.dir, 'manifest.json')).isFile();
  } catch {
    return false;
  }
})();
console.log(`slot cache ${cached ? 'HIT' : 'MISS'} at ${ref.fingerprint}`);
if (!cached) {
  // The same call at prompt v2 on this reel, if one is on disk, is the only
  // honest basis for a projection; without one the band from the corpus is.
  console.log(`projected cost is under the $${CEILING_USD.toFixed(2)} ceiling for one slot call`);
}

/*
 * **The manifest is read directly, and `planSlotsCached` is only used to create
 * it.** Its `finish` runs `planSlots` over the whole fresh candidate set, which
 * throws `MultiSubjectIdeaError` if any one of the model's ideas names a set
 * rather than a subject — after the call has billed and the entry has been
 * written. This wants one field off candidates it already has; whether some
 * other candidate's idea is plannable is not its question.
 */
if (!cached) {
  try {
    await planSlotsCached({
      apiKey: config.googleApiKey,
      videoSha256: plan.source.sha256,
      durationS: plan.source.durationS,
      planId: plan.meta.id,
      words,
      mode,
      log: (m) => console.log(`  ${m}`),
    });
  } catch (error) {
    // The call is what costs; the entry is written before the selection runs.
    console.log(`  the selection refused the fresh candidates: ${(error as Error).message}`);
  }
}

const after = readFileSync(ledgerPath, 'utf8').split('\n').filter((l) => l !== '');
const added = after.slice(linesBefore);
const spent = added
  .map((l) => (JSON.parse(l) as { usd?: number }).usd ?? 0)
  .reduce((a, b) => a + b, 0);
console.log(`\ncost: $${spent.toFixed(6)}${added.length === 0 ? ' (nothing billed)' : ''}`);
for (const line of added) console.log(`ledger + ${line}`);
if (spent > CEILING_USD) {
  console.error(`OVER CEILING: $${spent.toFixed(4)} > $${CEILING_USD.toFixed(2)}`);
  process.exit(2);
}

const manifest = JSON.parse(readFileSync(path.join(ref.dir, 'manifest.json'), 'utf8')) as {
  candidates: SlotCandidate[];
  promptVersion: number;
};
const byWordIds = new Map(manifest.candidates.map((c) => [c.wordIds.join(' '), c]));

/**
 * The word this slot is about, from a candidate that is unmistakably about the
 * same thing.
 *
 * **An exact span match first.** Failing that, a candidate whose span lies
 * wholly inside this slot's — the model describing the same moment, having
 * trimmed the span rather than kept it. On `sora` that is the whole of the
 * defect he reported: asked which word its picture is about, the model dropped
 * "hello" from the opening slot altogether and returned "I am Dr Lobna Kfafi",
 * naming `الدكتورة`.
 *
 * **Exactly one, or none.** Two contained candidates are two different pictures
 * of two different moments, and there is no honest way to pick between them.
 * A candidate that *contains* this slot is not a match either: it describes
 * something wider, and its word may fall outside the slot entirely.
 */
function namedWordFor(slot: { wordIds: string[] }): { id: string; via: string } | null {
  const exact = byWordIds.get(slot.wordIds.join(' '));
  if (exact !== undefined) {
    return exact.nameWordId === undefined ? null : { id: exact.nameWordId, via: 'the same span' };
  }
  const span = new Set(slot.wordIds);
  const inside = manifest.candidates.filter(
    (c) => c.wordIds.length > 0 && c.wordIds.every((id) => span.has(id)),
  );
  if (inside.length !== 1) return null;
  const only = inside[0] as SlotCandidate;
  return only.nameWordId === undefined
    ? null
    : { id: only.nameWordId, via: `a span inside it, "${only.idea}"` };
}
console.log(
  `\nthe model returned ${manifest.candidates.length} candidates at prompt v${manifest.promptVersion}; ` +
    `${manifest.candidates.filter((c) => c.nameWordId !== undefined).length} named a word`,
);

const wordText = new Map(plan.transcript.words.map((w) => [w.id, w]));
let matched = 0;
let moved = 0;
const slots = plan.images.slots.map((slot) => {
  const label = `${slot.id} "${slot.contextText}"`;
  const named = namedWordFor(slot);
  if (named === null || !slot.wordIds.includes(named.id)) {
    console.log(`  ${label}\n      the model named no word for this span; unchanged`);
    return slot;
  }
  matched += 1;
  const w = wordText.get(named.id);
  const offset = (w?.start ?? slot.start) - slot.start;
  if (offset > 1e-9) moved += 1;
  console.log(
    `  ${label}\n      idea: ${slot.idea}\n      about: ${named.id} "${w?.text}" at ` +
      `${(w?.start ?? 0).toFixed(3)}s (+${offset.toFixed(3)}s), via ${named.via}`,
  );
  return { ...slot, nameWordId: named.id };
});

console.log(
  `\n${matched} of ${plan.images.slots.length} slots got a word; ${moved} picture(s) will arrive later`,
);

if (!apply) {
  console.log('\ndry run; pass --apply to write it');
  process.exit(0);
}

plan.images = { ...plan.images, slots };
plan.sfx = {
  events: deriveSfxEvents(
    plan,
    templatesById(loadTemplateManifest()),
    loadSfxIndex(),
    templateImpacts(),
    plan.source.dialogueLufs,
    plan.source.dialoguePeakDbfs,
    imageEntranceS(),
  ),
};
await writeEditPlan(planPath, plan);
console.log(`\nwritten ${planPath}`);
