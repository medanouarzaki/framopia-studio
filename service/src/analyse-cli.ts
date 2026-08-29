import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { estimateGeminiTextCallCost, loadMode, readCosts } from '@framopia/core';
import { readEditPlan } from './editplan/io.js';
import { analyseKeywordsForPlan, planImageSlotsForPlan, planWordsForAnalysis } from './analysis/job.js';
import { analysisCacheRef, slotCacheRef } from './analysis/cached.js';
import { readAnalysisCache, readSlotCache } from './analysis/cache.js';
import { buildKeywordPrompt, candidateCountFor } from './analysis/keywords.js';
import { buildSlotPrompt, slotCandidateCountFor } from './analysis/slots.js';
import { imageSlotCountFor, keywordCountFor } from './analysis/count.js';
import type { KeywordMode } from './analysis/types.js';

/**
 * Roughly what one candidate costs in visible output tokens, measured off the
 * Block 3 session 3 responses. Feeds the pre-spend estimate only; actuals
 * always come from usageMetadata.
 */
const OUTPUT_TOKENS_PER_CANDIDATE = { keywords: 30, slots: 40 } as const;

async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(message)).trim().toLowerCase() === 'y';
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      plan: { type: 'string' },
      mode: { type: 'string', default: 'k2-syndicalia' },
      keywords: { type: 'string', default: 'auto' },
      stage: { type: 'string', default: 'keywords' },
      yes: { type: 'boolean', default: false },
      'no-cache': { type: 'boolean', default: false },
    },
  });

  if (!values.plan || !existsSync(values.plan)) {
    console.error(
      'Usage: npm run analyse -- --plan <path.editplan.json> [--stage keywords|slots] [--mode <id>] [--keywords auto|propose] [--yes] [--no-cache]',
    );
    process.exitCode = 1;
    return;
  }
  if (values.keywords !== 'auto' && values.keywords !== 'propose') {
    console.error(`--keywords must be auto or propose, got ${values.keywords}`);
    process.exitCode = 1;
    return;
  }
  const keywordMode = values.keywords as KeywordMode;

  const stage = values.stage as string;
  if (stage !== 'keywords' && stage !== 'slots') {
    console.error(`--stage must be keywords or slots, got ${stage}`);
    process.exitCode = 1;
    return;
  }

  const plan = await readEditPlan(values.plan);
  const mode = loadMode(values.mode as string);
  const words = planWordsForAnalysis(plan);
  const bypassCache = values['no-cache'] ?? false;

  const count =
    stage === 'keywords'
      ? keywordCountFor(plan.source.durationS)
      : imageSlotCountFor(plan.source.durationS, mode.imageSlotsPer30s);
  const candidateCount =
    stage === 'keywords' ? candidateCountFor(count) : slotCandidateCountFor(count);

  console.log(
    `${plan.source.durationS.toFixed(1)}s reel -> ${count} ${stage === 'keywords' ? 'keyword' : 'image slot'}(s), asking for ${candidateCount} candidates`,
  );
  const allTime = Object.values(readCosts()).reduce((n, v) => n + v, 0);
  console.log(`All-time ledger total: $${allTime.toFixed(6)}`);

  const ref =
    stage === 'keywords'
      ? analysisCacheRef({ videoSha256: plan.source.sha256, mode, words, candidateCount }).ref
      : slotCacheRef({ videoSha256: plan.source.sha256, mode, words, candidateCount }).ref;
  const willHit =
    !bypassCache &&
    (stage === 'keywords'
      ? (await readAnalysisCache(ref)).payload !== null
      : (await readSlotCache(ref)).payload !== null);

  if (willHit) {
    console.log('Cache hit — no billable calls for this run.');
  } else {
    // Estimated from the prompt that will actually be sent, not from a
    // duration this call does not have. Both stages are text in, JSON out.
    const prompt =
      stage === 'keywords'
        ? buildKeywordPrompt({ words, mode, candidateCount })
        : buildSlotPrompt({ words, mode, candidateCount, durationS: plan.source.durationS });
    const estimate = estimateGeminiTextCallCost({
      promptChars: prompt.length,
      expectedOutputTokens: candidateCount * OUTPUT_TOKENS_PER_CANDIDATE[stage],
    });
    console.log(
      `Estimated cost: ~$${estimate.toFixed(4)} (pessimistic — the thinking multiplier is a spend gate, not a forecast)`,
    );
    if (!values.yes && !(await confirm(`Proceed with a billable call? [y/N] `))) {
      console.error('aborted: cost confirmation declined');
      process.exitCode = 1;
      return;
    }
  }

  const log = (m: string): void => {
    console.log(m);
  };

  if (stage === 'slots') {
    const result = await planImageSlotsForPlan({
      planPath: values.plan,
      modeId: mode.id,
      bypassCache,
      log,
    });
    const { selection } = result.analysis;
    console.log(
      result.cached
        ? 'Cost: $0.0000 — served from cache, nothing billed'
        : `Cost: $${result.analysis.costUsd.toFixed(4)}`,
    );
    const unresolved = selection.failures.filter((f) => f.reason === 'unknown-word-id' || f.reason === 'empty-word-ids');
    console.log(
      `${selection.slots.length}/${selection.requestedCount} slot(s), ` +
        `${unresolved.length} resolution failure(s), ` +
        `${selection.failures.length - unresolved.length} spread/overlap rejection(s), ` +
        `${result.analysis.wallTimeS.toFixed(1)}s`,
    );
    if (selection.shortfall > 0) {
      console.log(`  shortfall: ${selection.shortfall} slot(s) the candidates could not supply`);
    }
    console.log(
      `  gaps between slots: ${selection.gaps.map((g) => `${g.toFixed(2)}s`).join(', ') || 'n/a'}`,
    );
    console.log(`  uncovered reel time: ${selection.uncoveredS.toFixed(2)}s`);
    for (const slot of result.plan.images.slots) {
      const planned = selection.slots.find((sl) => sl.wordIds.join() === slot.wordIds.join());
      console.log(`  ${slot.id} [${slot.start.toFixed(2)}-${slot.end.toFixed(2)}s] ${slot.idea}`);
      console.log(`      variation: ${JSON.stringify(planned?.variation ?? {})}`);
      console.log(`      prompt: ${slot.prompt}`);
      console.log(`      negative: ${slot.negativePrompt}`);
    }
    return;
  }

  const result = await analyseKeywordsForPlan({
    planPath: values.plan,
    modeId: mode.id,
    keywordMode,
    bypassCache,
    log,
  });

  const { selection } = result.analysis;
  console.log(
    result.cached
      ? 'Cost: $0.0000 — served from cache, nothing billed'
      : `Cost: $${result.analysis.costUsd.toFixed(4)}`,
  );
  const diversitySkips = selection.failures.filter((f) => f.reason === 'shares-a-head-term');
  const resolutionFailures = selection.failures.filter((f) => f.reason !== 'shares-a-head-term');
  console.log(
    `${result.plan.keywords.items.length}/${selection.requestedCount} keyword(s), mode ${keywordMode}, ` +
      `${resolutionFailures.length} resolution failure(s), ${diversitySkips.length} diversity skip(s), ` +
      `${selection.narrowed.length} narrowed, ${selection.textMismatches.length} text mismatch(es), ` +
      `${result.analysis.wallTimeS.toFixed(1)}s`,
  );
  if (selection.shortfall > 0) {
    console.log(`  shortfall: ${selection.shortfall} keyword(s) the candidates could not supply`);
  }
  for (const n of selection.narrowed) {
    console.log(`  narrowed: "${n.originalText}" -> "${n.text}"`);
  }
  for (const skip of diversitySkips) {
    console.log(`  diversity skip: "${skip.candidate.text}"`);
  }
  if (selection.kindShortfall.length > 0) {
    console.log(
      `  kind shortfall: the candidates supplied no ${selection.kindShortfall.join(' and no ')}`,
    );
  }
  for (const item of result.plan.keywords.items) {
    console.log(
      `  ${item.id} [${item.kind ?? 'unkinded'}] ${item.text} (${item.score.toFixed(2)}) [${item.start.toFixed(2)}-${item.end.toFixed(2)}s] approved=${item.approved} — ${item.reason}`,
    );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
