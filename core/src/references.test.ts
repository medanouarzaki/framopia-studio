import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './paths.js';
import {
  ALIGNMENT_REFERENCES,
  REFERENCE_DOCUMENTATION,
  REFERENCE_FILES,
  REFERENCE_SET_DEFINITION,
  TRANSCRIPT_REELS,
  referenceFilesRootedAt,
  referenceSetSummary,
} from './references.js';

describe('the hand-made reference declaration', () => {
  it('is every file the read sites need, and nothing regenerable', () => {
    expect(REFERENCE_FILES).toHaveLength(TRANSCRIPT_REELS.length + ALIGNMENT_REFERENCES.length);
    expect(REFERENCE_FILES.filter((f) => f.kind === 'transcript')).toHaveLength(4);
    expect(REFERENCE_FILES.filter((f) => f.kind === 'alignment')).toHaveLength(2);
  });

  it('every declared reference is on this disk', () => {
    const missing = REFERENCE_FILES.filter((f) => !existsSync(f.path)).map((f) => f.path);
    expect(missing).toEqual([]);
  });

  /**
   * The declaration is what the gate protects, so it must not fall behind the
   * disk — the same reason `REPO_ANCHORS` is pinned against `readdirSync`. A
   * hand-made reference added to a reference directory and not declared here is
   * one nothing is guarding.
   */
  it('knows every hand-made file in the directories it owns', () => {
    const declared = new Set(REFERENCE_FILES.map((f) => f.path));
    const undeclared: string[] = [];
    for (const dir of new Set(REFERENCE_FILES.map((f) => path.dirname(f.path)))) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isFile() || entry.name.startsWith('.')) continue;
        if (REFERENCE_DOCUMENTATION.includes(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (declared.has(full)) continue;
        // `.local/ground-truth/*.json` is rebuilt by `npm run bench:tag`.
        if (dir.endsWith(path.join('.local', 'ground-truth')) && !entry.name.endsWith('.txt')) continue;
        undeclared.push(full);
      }
    }
    expect(undeclared).toEqual([]);
  });

  it('states its own definition, and the summary carries both kinds', () => {
    expect(REFERENCE_SET_DEFINITION).toContain('nothing can regenerate');
    expect(REFERENCE_SET_DEFINITION).toContain('README');
    expect(referenceSetSummary()).toBe('6 hand-made reference file(s): 4 transcript, 2 alignment');
  });

  it('does not count a README as a reference', () => {
    expect(REFERENCE_FILES.map((f) => path.basename(f.path))).not.toContain('README.md');
    expect(REFERENCE_DOCUMENTATION).toContain('README.md');
  });

  it('names what reads each file, so a failure says what stops working', () => {
    for (const file of REFERENCE_FILES) {
      expect(file.readBy).not.toBe('');
      expect(file.id).toContain(file.reel);
    }
  });

  it('re-roots onto a scratch directory without touching the real paths', () => {
    const rerooted = referenceFilesRootedAt('/tmp/somewhere');
    expect(rerooted).toHaveLength(REFERENCE_FILES.length);
    for (const file of rerooted) {
      expect(file.path.startsWith('/tmp/somewhere')).toBe(true);
      expect(file.path.startsWith(REPO_ROOT)).toBe(false);
    }
    // the real declaration is untouched
    expect(REFERENCE_FILES.every((f) => f.path.startsWith(REPO_ROOT))).toBe(true);
  });
});
