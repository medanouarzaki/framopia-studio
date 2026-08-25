import { readFileSync } from 'node:fs';
import path from 'node:path';
import { LOCAL_DIR } from '@framopia/core';
import { loadGroundTruth } from './ground-truth.js';
import { normalizeForWer } from './normalize.js';
import { align, computeSubsetWer, scoreAlignment, type WerResult } from './wer.js';

/**
 * Scores a production Edit Plan against a benchmark reference. Only the word
 * texts are read, so this adapter has no dependency on the service package
 * and cannot drift with the plan's other containers.
 */
export interface PlanShape {
  transcript: { words: { text: string; removed?: boolean }[] };
}

/** Removed words are the plan's record of a deletion, not part of the read. */
export function planWords(plan: PlanShape): string[] {
  return plan.transcript.words.filter((w) => w.removed !== true).map((w) => w.text);
}

export function readPlanWords(planPath: string): string[] {
  return planWords(JSON.parse(readFileSync(planPath, 'utf8')) as PlanShape);
}

export interface PlanScores {
  overall: WerResult;
  darija: WerResult;
  codeSwitched: WerResult;
  referenceVersion: string;
  wordCount: number;
}

export function scorePlanAgainstReel(planPath: string, reel: string): PlanScores {
  const groundTruth = loadGroundTruth(path.join(LOCAL_DIR, 'ground-truth', `${reel}.json`));
  const hypothesis = readPlanWords(planPath);
  const reference = groundTruth.words.map((w) => w.text);
  return {
    overall: scoreAlignment(align(normalizeForWer(reference), normalizeForWer(hypothesis))),
    darija: computeSubsetWer(groundTruth.words, hypothesis, ['darija']),
    codeSwitched: computeSubsetWer(groundTruth.words, hypothesis, ['fr', 'en']),
    referenceVersion: groundTruth.version ?? 'unversioned',
    wordCount: hypothesis.length,
  };
}
