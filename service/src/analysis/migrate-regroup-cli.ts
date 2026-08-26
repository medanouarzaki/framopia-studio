import { readdirSync } from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT,
  loadMode,
  loadSfxIndex,
  loadTemplateManifest,
  templatesById,
} from '@framopia/core';
import { readEditPlan, writeEditPlan } from '../editplan/io.js';
import { groupWordsIntoSubtitles } from '../transcription/grouping.js';
import { regroupForKeywords } from './regroup.js';
import { applyDisplayTiming } from './display-timing.js';
import { assignTemplates } from './assign.js';
import { deriveSfxEvents } from './sfx.js';

/**
 * Re-groups every existing plan to one word per card and re-derives everything
 * downstream of grouping.
 *
 * All of it is pure local computation over the stored transcript — grouping,
 * keyword supersession, display timing, template assignment, SFX — so **this
 * cannot bill**. Nothing is re-transcribed and nothing is re-analysed; the
 * words and the keyword spans are read from the plan as they are.
 *
 * The order is load-bearing and was learned the hard way: grouping, then
 * keyword supersession, then display timing, then template assignment, then
 * SFX. Display timing needs each card's template floor, and a card that
 * changes identity carries no template until assignment runs, so assignment
 * has to come after. Running it earlier is what left three reels with windows
 * computed against a null floor in session 4.
 *
 * Dry-run by default.
 */
const FOOTAGE_DIR = path.join(REPO_ROOT, 'my files', 'test videos');

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const modeIndex = argv.indexOf('--mode');
const modeId = modeIndex === -1 ? 'k2-syndicalia' : (argv[modeIndex + 1] as string);

const mode = loadMode(modeId);
const templates = templatesById(loadTemplateManifest());
const sfxIndex = loadSfxIndex();

let totalBefore = 0;
let totalAfter = 0;

for (const file of readdirSync(FOOTAGE_DIR).filter((f) => f.endsWith('.editplan.json')).sort()) {
  const reel = file.replace('.editplan.json', '');
  const planPath = path.join(FOOTAGE_DIR, file);
  const plan = await readEditPlan(planPath);

  const before = plan.subtitles.groups.length;
  const floor = (id: string | null): number => {
    const t = id === null ? undefined : templates.get(id);
    return t === undefined ? 0 : t.introS + t.minHoldS + t.outroS;
  };
  const unbuildableBefore = plan.subtitles.groups.filter(
    (g) => (g.displayEnd ?? g.end) - (g.displayStart ?? g.start) < floor(g.templateId) - 1e-9,
  ).length;

  plan.subtitles.groups = groupWordsIntoSubtitles(plan.transcript.words);

  const regrouped = regroupForKeywords({
    groups: plan.subtitles.groups,
    words: plan.transcript.words,
    keywords: plan.keywords.items.map((k) => ({ id: k.id, wordIds: k.wordIds })),
  });
  plan.subtitles.groups = regrouped.groups;
  const kept = new Set(regrouped.keptKeywordIds);
  const droppedKeywords = plan.keywords.items.filter((k) => !kept.has(k.id));
  plan.keywords.items = plan.keywords.items.filter((k) => kept.has(k.id));

  /*
   * Assignment must come *before* display timing here, which inverts the order
   * session 5 established. The reason that order existed was the merge rescue:
   * a merge created a card with no template, so assignment had to follow it. At
   * one word per card merging is off, nothing changes identity during display
   * timing, and display timing needs each card's template floor — run the other
   * way round it reads a null floor and reports every card buildable, which is
   * exactly the defect session 5 found on three reels.
   */
  assignTemplates(plan, mode, templates);

  const timing = applyDisplayTiming({
    groups: plan.subtitles.groups,
    templates,
    reelDurationS: plan.source.durationS,
  });
  plan.subtitles.groups = timing.groups;

  // Deterministic, so re-running is free and guarantees a card that changed
  // identity is never left without a template.
  const assignment = assignTemplates(plan, mode, templates);
  plan.sfx = { events: deriveSfxEvents(plan, templates, sfxIndex) };

  const after = plan.subtitles.groups.length;
  const unbuildableAfter = timing.unbuildable.length;
  totalBefore += before;
  totalAfter += after;

  console.log(
    `\n== ${reel}: cards ${before} -> ${after}; unbuildable ${unbuildableBefore} -> ` +
      `${unbuildableAfter}; merges ${timing.merged.length}; sfx ${plan.sfx.events.length}`,
  );
  const twoWordKeywords = plan.keywords.items.filter((k) => k.wordIds.length > 1);
  if (twoWordKeywords.length > 0) {
    console.log(
      `   two-word keywords (own card, for the user's eye): ${twoWordKeywords
        .map((k) => `${k.id} "${k.text}"`)
        .join(', ')}`,
    );
  }
  for (const d of regrouped.dropped) console.log(`   DROPPED keyword ${d.keywordId}: ${d.reason}`);
  for (const d of droppedKeywords) console.log(`   removed from plan: ${d.id} "${d.text}"`);
  for (const issue of assignment.issues) console.log(`   issue ${issue.path}: ${issue.message}`);

  if (apply) {
    plan.meta.updatedAt = new Date().toISOString();
    await writeEditPlan(planPath, plan);
    const reread = await readEditPlan(planPath);
    const oversize = reread.subtitles.groups.filter((g) => g.wordIds.length > 1).length;
    console.log(
      `   written and reopened: ${reread.subtitles.groups.length} cards, ` +
        `${oversize} with more than one word, ` +
        `${reread.subtitles.groups.filter((g) => g.templateId !== null).length} templated`,
    );
  }
}

console.log(`\ncards ${totalBefore} -> ${totalAfter}. $0.00 — no model call.`);
if (!apply) console.log('dry run — pass --apply to write');
