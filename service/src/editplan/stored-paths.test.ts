import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '@framopia/core';
import { readEditPlan } from './io.js';
import { loadReels } from '../frames/footage.js';

/**
 * A rule with more than one implementation is pinned by a test in this repo,
 * and a rule with one implementation that anything could bypass needs the same
 * treatment. Session 8 found three private copies of a predicate by grepping;
 * this greps for a stored path being read without going through the resolver.
 */

/** Every `.ts` under a directory, comments and strings left in — see below. */
function sources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.venv') continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sources(full));
    else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

/**
 * Comments are stripped before scanning, on the precedent of the ExtendScript
 * gate: a comment explaining why a field is resolved must not read as a use of
 * it. Strings are left, because a field name in a string is usually a real
 * lookup by key.
 */
function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/^\s*\/\/.*$/gmu, '');
}

const FIELDS = [
  'source.videoPath',
  'source.audioPath',
  'clientMode.path',
  'watermark.assetPath',
] as const;

describe('nothing reads a stored path without resolving it', () => {
  const files = [
    ...sources(path.join(REPO_ROOT, 'service', 'src')),
    ...sources(path.join(REPO_ROOT, 'tools')),
  ];

  /*
   * The two chokepoints. Everything else gets its plan from `readEditPlan` and
   * its reels from `loadReels`, so resolving there covers every downstream
   * reader without touching them — the same shape as `readTranscriptionCache`
   * overwriting a manifest's stored `audioPath`.
   */
  it('readEditPlan resolves all six fields a plan can carry', () => {
    const io = readFileSync(path.join(REPO_ROOT, 'service/src/editplan/io.ts'), 'utf8');
    expect(io).toContain('resolveStoredPath');
    for (const field of FIELDS) expect(io, field).toContain(field);
    expect(io).toContain('candidate.path');
    expect(io).toContain('candidate.cutoutPath');
    expect(io).toContain('resolvePlanPaths(assertValidEditPlan(parsed))');
  });

  it('loadReels resolves the path footage.json stores', () => {
    const footage = readFileSync(path.join(REPO_ROOT, 'service/src/frames/footage.ts'), 'utf8');
    expect(footage).toContain('resolveStoredPath');
  });

  /*
   * A module that parses a plan itself does not get `readEditPlan`'s resolving,
   * so it has to do its own. `steps.ts` is the one that reads a path that way.
   */
  it('every module that parses a plan itself and reads a path resolves it', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const text = withoutComments(readFileSync(file, 'utf8'));
      const parsesAPlan = text.includes('JSON.parse') && text.includes('editplan.json');
      if (!parsesAPlan) continue;
      const readsAPath =
        FIELDS.some((f) => text.includes(f)) ||
        /\bcandidate\.(?:cutoutPath|path)\b/u.test(text) ||
        /\bc\.(?:cutoutPath|path)\b/u.test(text);
      if (!readsAPath) continue;
      if (!text.includes('resolveStoredPath') && !text.includes('readEditPlan')) {
        offenders.push(path.relative(REPO_ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('the corpus, read through the resolver', () => {
  /* On this machine every stored path is already here, so nothing should move. */
  it('every plan opens and every path it carries is absolute and present', async () => {
    const dir = path.join(REPO_ROOT, 'my files', 'test videos');
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.editplan.json'))) {
      const plan = await readEditPlan(path.join(dir, file));
      expect(path.isAbsolute(plan.source.videoPath), file).toBe(true);
      expect(plan.source.videoPath.startsWith(REPO_ROOT), file).toBe(true);
      expect(plan.source.audioPath.startsWith(REPO_ROOT), file).toBe(true);
      if (plan.clientMode !== null) {
        expect(plan.clientMode.path.startsWith(REPO_ROOT), file).toBe(true);
      }
      if (plan.watermark !== null) {
        expect(plan.watermark.assetPath.startsWith(REPO_ROOT), file).toBe(true);
      }
      for (const slot of plan.images.slots) {
        for (const candidate of slot.candidates) {
          expect(candidate.path.startsWith(REPO_ROOT), `${file} ${candidate.id}`).toBe(true);
          if (candidate.cutoutPath != null) {
            expect(candidate.cutoutPath.startsWith(REPO_ROOT), `${file} ${candidate.id}`).toBe(true);
          }
        }
      }
    }
  });

  it('every catalogued reel path is rooted here', () => {
    for (const reel of loadReels()) {
      expect(reel.path.startsWith(REPO_ROOT), reel.label).toBe(true);
    }
  });
});
