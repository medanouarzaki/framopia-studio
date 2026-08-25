import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { estimateGeminiCallCost, loadMode, readCosts } from '@framopia/core';
import { readEditPlan } from './editplan/io.js';
import { analyseKeywordsForPlan, planWordsForAnalysis } from './analysis/job.js';
import { analysisCacheRef } from './analysis/cached.js';
import { readAnalysisCache } from './analysis/cache.js';
import { candidateCountFor } from './analysis/keywords.js';
import { keywordCountFor } from './analysis/count.js';
import type { KeywordMode } from './analysis/types.js';

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
      yes: { type: 'boolean', default: false },
      'no-cache': { type: 'boolean', default: false },
    },
  });

  if (!values.plan || !existsSync(values.plan)) {
    console.error(
      'Usage: npm run analyse -- --plan <path.editplan.json> [--mode <id>] [--keywords auto|propose] [--yes] [--no-cache]',
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

  const plan = await readEditPlan(values.plan);
  const mode = loadMode(values.mode as string);
  const words = planWordsForAnalysis(plan);
  const keywordCount = keywordCountFor(plan.source.durationS);
  const candidateCount = candidateCountFor(keywordCount);
  const bypassCache = values['no-cache'] ?? false;

  console.log(
    `${plan.source.durationS.toFixed(1)}s reel -> ${keywordCount} keyword(s), asking for ${candidateCount} candidates`,
  );
  const allTime = Object.values(readCosts()).reduce((n, v) => n + v, 0);
  console.log(`All-time ledger total: $${allTime.toFixed(6)}`);

  const { ref } = analysisCacheRef({
    videoSha256: plan.source.sha256,
    mode,
    words,
    candidateCount,
  });
  const willHit = !bypassCache && (await readAnalysisCache(ref)).payload !== null;

  if (willHit) {
    console.log('Cache hit — no billable calls for this run.');
  } else {
    // Text in, JSON out: no audio part, so the estimate is the text-only
    // Gemini estimate rather than the transcription one.
    const estimate = estimateGeminiCallCost(0);
    console.log(`Estimated cost: ~$${estimate.toFixed(4)}`);
    if (!values.yes && !(await confirm(`Proceed with a billable call? [y/N] `))) {
      console.error('aborted: cost confirmation declined');
      process.exitCode = 1;
      return;
    }
  }

  const result = await analyseKeywordsForPlan({
    planPath: values.plan,
    modeId: mode.id,
    keywordMode,
    bypassCache,
    log: (m) => {
      console.log(m);
    },
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
  for (const item of result.plan.keywords.items) {
    console.log(
      `  ${item.id} ${item.text} (${item.score.toFixed(2)}) [${item.start.toFixed(2)}-${item.end.toFixed(2)}s] approved=${item.approved} — ${item.reason}`,
    );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
