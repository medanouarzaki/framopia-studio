import { loadConfig, loadMode, type ClientMode } from '@framopia/core';
import { readEditPlan, writeEditPlan } from '../editplan/io.js';
import type { EditPlan, KeywordItem } from '../editplan/types.js';
import { analyseKeywordsCached, type CachedKeywordResult } from './cached.js';
import { ACTIVE_ANALYSIS_PROMPT_VERSION } from './keywords.js';
import type { AnalysisWord, KeywordMode } from './types.js';

/** Mirrors transcriptionConfigLabel: the prompt version is the identity. */
export function analysisConfigLabel(promptVersion: number, mode: ClientMode): string {
  return `keywords-prompt-v${promptVersion}-${mode.id}-v${mode.version}`;
}

export function planWordsForAnalysis(plan: EditPlan): AnalysisWord[] {
  return plan.transcript.words.map((w) => ({
    id: w.id,
    text: w.text,
    start: w.start,
    end: w.end,
    removed: w.removed,
  }));
}

export interface AnalyseKeywordsOptions {
  planPath: string;
  modeId: string;
  keywordMode: KeywordMode;
  bypassCache?: boolean;
  cacheRoot?: string;
  log?: (message: string) => void;
  now?: () => string;
  /** Injected in tests, so a plan can be enriched without an API key. */
  runCached?: typeof analyseKeywordsCached;
}

export interface AnalyseKeywordsResult {
  planPath: string;
  plan: EditPlan;
  analysis: CachedKeywordResult;
  cached: boolean;
}

/**
 * Reads a plan, runs keyword analysis over its transcript, and writes the
 * result back. `writeEditPlan` validates first, so a keyword that does not
 * resolve, claims a removed word or overlaps another cannot reach disk.
 */
export async function analyseKeywordsForPlan(
  options: AnalyseKeywordsOptions,
): Promise<AnalyseKeywordsResult> {
  const {
    planPath,
    modeId,
    keywordMode,
    bypassCache = false,
    cacheRoot,
    log = (): void => undefined,
    now = () => new Date().toISOString(),
    runCached = analyseKeywordsCached,
  } = options;

  const plan = await readEditPlan(planPath);
  const mode = loadMode(modeId);
  const config = loadConfig();
  const words = planWordsForAnalysis(plan);

  const analysis = await runCached({
    apiKey: config.googleApiKey,
    videoSha256: plan.source.sha256,
    durationS: plan.source.durationS,
    words,
    mode,
    keywordMode,
    bypassCache,
    cacheRoot,
    log,
  });

  for (const warning of analysis.warnings) log(`warning [analysis]: ${warning}`);
  for (const failure of analysis.selection.failures) {
    log(
      `analysis: dropped candidate ${JSON.stringify(failure.candidate.wordIds)} (${failure.reason})`,
    );
  }

  // auto approves what it selected; propose leaves the checkboxes for the
  // panel. The selection itself is identical either way — the mode is a run
  // parameter and never reaches the model.
  const approved = keywordMode === 'auto';
  const items: KeywordItem[] = analysis.selection.items.map((item, i) => ({
    id: `k${String(i + 1).padStart(3, '0')}`,
    wordIds: item.wordIds,
    text: item.text,
    score: item.score,
    reason: item.reason,
    approved,
    templateId: null,
    start: item.start,
    end: item.end,
  }));

  const timestamp = now();
  plan.keywords = { mode: keywordMode, items };
  plan.pipeline.analysis = {
    status: 'done',
    config: analysisConfigLabel(ACTIVE_ANALYSIS_PROMPT_VERSION, mode),
    costUsd: analysis.cached ? 0 : analysis.costUsd,
    cached: analysis.cached,
    completedAt: timestamp,
    error: null,
  };
  // Zero on a hit rather than absent, for the reason transcription records
  // its own zero: a byStage key that appears and vanishes between runs reads
  // as a pipeline change.
  const stageCost = analysis.cached ? 0 : analysis.costUsd;
  plan.costs.byStage.analysis = stageCost;
  plan.costs.totalUsd = Object.values(plan.costs.byStage).reduce((n, v) => n + v, 0);
  plan.meta.updatedAt = timestamp;

  await writeEditPlan(planPath, plan);

  return { planPath, plan, analysis, cached: analysis.cached };
}
