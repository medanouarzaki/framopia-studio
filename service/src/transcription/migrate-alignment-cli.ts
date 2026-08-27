import { readdirSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, loadSfxIndex, loadTemplateManifest, templatesById } from '@framopia/core';
import { readEditPlan, writeEditPlan } from '../editplan/io.js';
import { transcriptContentHash } from '../editplan/merge.js';
import { applyDisplayTiming } from '../analysis/display-timing.js';
import { deriveSfxEvents } from '../analysis/sfx.js';
import { hashTranscript } from '../analysis/fingerprint.js';
import type { EditPlan, PlanWord } from '../editplan/types.js';
import { alignCorrectedOntoDraft } from './align.js';
import { mapScribeResponse, type ScribeRawResponse } from './scribe.js';
import { readTranscriptionCache } from './cache.js';
import { resolveTranscriptionEntry } from './resolve-entry.js';

/**
 * Puts the transliteration-aware alignment adopted in Block 8 session 12 onto
 * the plans, which still carry timings from the flat cost model.
 *
 * **$0.00 and no API call.** Alignment is pure: the raw Scribe response and the
 * corrected texts are both in the cache entry, and re-running the aligner over
 * them is arithmetic. It imports `alignCorrectedOntoDraft` rather than
 * reimplementing it, so a migrated plan and one written by a fresh run carry
 * identical timings.
 *
 * Everything deterministically derived from a word timing is recomputed in the
 * same pass — card spans, display timing, keyword and slot spans, SFX event
 * times and `transcript.contentHash` — because a plan whose words say one thing
 * and whose cards say another is worse than one that was never migrated.
 *
 * Nothing derived from word **text** may move. Session 13 established that the
 * emitted word texts and their order are byte-identical across every cost
 * model, so `hashTranscript` must not change; if it does, the run stops rather
 * than writing a plan whose keywords and image prompts no longer describe it.
 */
const FOOTAGE_DIR = path.join(REPO_ROOT, 'my files', 'test videos');

class MigrationError extends Error {}

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const dirIndex = argv.indexOf('--footage');
const dir = dirIndex === -1 ? FOOTAGE_DIR : (argv[dirIndex + 1] as string);

const templates = templatesById(loadTemplateManifest());
const sfxIndex = loadSfxIndex();

function spanOf(wordIds: string[], byId: Map<string, PlanWord>): { start: number; end: number } {
  const words = wordIds.map((id) => byId.get(id)).filter((w): w is PlanWord => w !== undefined);
  if (words.length === 0) return { start: 0, end: 0 };
  return {
    start: Math.min(...words.map((w) => w.start)),
    end: Math.max(...words.map((w) => w.end)),
  };
}

async function realignedWords(plan: EditPlan, reel: string): Promise<PlanWord[]> {
  const entry = await resolveTranscriptionEntry({ videoSha256: plan.source.sha256 });
  if (entry.dir === null) {
    throw new MigrationError(`${reel}: ${entry.note}. Nothing to re-align from.`);
  }
  const { payload } = await readTranscriptionCache({
    dir: entry.dir,
    videoSha256: plan.source.sha256,
    stage: 'transcription',
    fingerprint: entry.wantedFingerprint,
  });
  if (payload === null) throw new MigrationError(`${reel}: ${entry.dir} holds no readable payload`);

  console.log(`${reel.padEnd(14)} ${entry.provenance}: ${entry.id}`);

  const draft = mapScribeResponse(payload.scribeRaw as ScribeRawResponse);
  const aligned = alignCorrectedOntoDraft(draft, payload.correctedTexts);

  if (aligned.length !== plan.transcript.words.length) {
    throw new MigrationError(
      `${reel}: the aligner produced ${aligned.length} words against the plan's ` +
        `${plan.transcript.words.length}. The cache entry does not describe this plan.`,
    );
  }

  // Updated in place rather than rebuilt: `lang`, `removed`, `edited` and the
  // rest are text-derived and must survive untouched.
  return plan.transcript.words.map((word, i) => {
    const a = aligned[i];
    if (a === undefined || a.text !== word.text) {
      throw new MigrationError(
        `${reel}: word ${word.id} is "${word.text}" on the plan and ` +
          `"${a?.text ?? '(missing)'}" from the aligner. Refusing to migrate.`,
      );
    }
    return {
      ...word,
      start: a.start ?? 0,
      end: a.end ?? a.start ?? 0,
      sourceText: a.sourceText ?? a.text,
      confidence: a.confidence,
    };
  });
}

let totalWordsMoved = 0;
let totalCardsMoved = 0;
const failures: string[] = [];

for (const file of readdirSync(dir).filter((f) => f.endsWith('.editplan.json')).sort()) {
  const reel = file.replace('.editplan.json', '');
  const planPath = path.join(dir, file);
  const plan = await readEditPlan(planPath);

  let words: PlanWord[];
  try {
    words = await realignedWords(plan, reel);
  } catch (error) {
    if (!(error instanceof MigrationError)) throw error;
    console.log(`${reel.padEnd(14)} SKIPPED — ${(error as Error).message}`);
    failures.push(reel);
    continue;
  }

  const textHashBefore = hashTranscript(plan.transcript.words);
  const textHashAfter = hashTranscript(words);
  if (textHashBefore !== textHashAfter) {
    console.log(
      `${reel.padEnd(14)} SKIPPED — the text hash moved (${textHashBefore} -> ${textHashAfter}); ` +
        'alignment must not change word text',
    );
    failures.push(reel);
    continue;
  }

  const wordsMoved = words.filter((w, i) => {
    const before = plan.transcript.words[i] as PlanWord;
    return w.start !== before.start || w.end !== before.end;
  }).length;
  const sourceTextMoved = words.filter(
    (w, i) => w.sourceText !== (plan.transcript.words[i] as PlanWord).sourceText,
  ).length;

  const byId = new Map(words.map((w) => [w.id, w]));
  const groupsBefore = plan.subtitles.groups.map((g) => ({ ...g }));

  plan.transcript.words = words;
  plan.subtitles.groups = plan.subtitles.groups.map((g) => ({ ...g, ...spanOf(g.wordIds, byId) }));
  plan.keywords.items = plan.keywords.items.map((k) => ({ ...k, ...spanOf(k.wordIds, byId) }));
  plan.images.slots = plan.images.slots.map((s) => ({ ...s, ...spanOf(s.wordIds, byId) }));

  const timing = applyDisplayTiming({
    groups: plan.subtitles.groups,
    templates,
    reelDurationS: plan.source.durationS,
  });
  if (timing.groups.length !== groupsBefore.length) {
    console.log(
      `${reel.padEnd(14)} SKIPPED — display timing would change the card count ` +
        `(${groupsBefore.length} -> ${timing.groups.length})`,
    );
    failures.push(reel);
    continue;
  }
  plan.subtitles.groups = timing.groups;

  const sfxBefore = plan.sfx.events.length;
  plan.sfx.events = deriveSfxEvents(plan, templates, sfxIndex);
  plan.transcript.contentHash = transcriptContentHash(plan);

  const cardsMoved = plan.subtitles.groups.filter((g, i) => {
    const b = groupsBefore[i];
    return (
      b === undefined ||
      g.start !== b.start ||
      g.end !== b.end ||
      g.displayStart !== b.displayStart ||
      g.displayEnd !== b.displayEnd
    );
  }).length;

  totalWordsMoved += wordsMoved;
  totalCardsMoved += cardsMoved;

  console.log(
    `${' '.repeat(14)} ${words.length} words: ${wordsMoved} retimed, ` +
      `${sourceTextMoved} sourceText changed; ${plan.subtitles.groups.length} cards: ` +
      `${cardsMoved} moved; sfx ${sfxBefore} -> ${plan.sfx.events.length}; ` +
      `keywords ${plan.keywords.items.length}, slots ${plan.images.slots.length}, ` +
      `candidates ${plan.images.slots.reduce((n, s) => n + s.candidates.length, 0)}; ` +
      `unbuildable ${timing.unbuildable.length}`,
  );

  if (apply) {
    plan.meta.updatedAt = new Date().toISOString();
    await writeEditPlan(planPath, plan);
    const reread = await readEditPlan(planPath);
    console.log(
      `${' '.repeat(14)} written and reopened: ${reread.transcript.words.length} words, ` +
        `${reread.subtitles.groups.length} cards, ` +
        `${reread.images.slots.reduce((n, s) => n + s.candidates.length, 0)} candidates, ` +
        `contentHash ${reread.transcript.contentHash}`,
    );
  }
}

console.log(
  `\n${totalWordsMoved} words retimed and ${totalCardsMoved} cards moved across the corpus. ` +
    '$0.00 — this migration makes no model call.',
);
if (failures.length > 0) console.log(`skipped: ${failures.join(', ')}`);
if (!apply) console.log('dry run — pass --apply to write');
