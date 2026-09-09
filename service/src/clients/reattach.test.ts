import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeReattachDir, keepPreviousAttachment } from './reattach.js';

/*
 * Its own directory, set before anything asks. Sessions 69 to 71 found suites
 * writing into the real `.local/plans/`, twice, and a killed run leaving the
 * copies there.
 */
const SCRATCH = mkdtempSync(path.join(tmpdir(), 'framopia-reattach-dir-'));
process.env['FRAMOPIA_REATTACH_DIR'] = SCRATCH;

/**
 * **Re-attaching keeps the plan as it stood.**
 *
 * Changing a reel's client rewrites the colours, the faces and the shadow it
 * will be built in. Nothing a person made is thrown away, so the plan is copied
 * aside first and the reply says where it went.
 */
const made: string[] = [];
afterEach(() => {
  for (const f of made.splice(0)) rmSync(f, { recursive: true, force: true });
});

afterAll(() => rmSync(SCRATCH, { recursive: true, force: true }));

function aPlan(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'framopia-reattach-'));
  made.push(dir);
  const file = path.join(dir, 'a reel.editplan.json');
  writeFileSync(file, JSON.stringify({ clientMode: { id: 'k2-syndicalia' } }), 'utf8');
  return file;
}

describe('keeping the previous attachment', () => {
  it('copies the plan aside and says where', () => {
    const plan = aPlan();
    const at = keepPreviousAttachment(plan);
    made.push(at);
    expect(existsSync(at)).toBe(true);
    expect(at.startsWith(beforeReattachDir())).toBe(true);
    // Byte for byte what the plan held.
    expect(readFileSync(at, 'utf8')).toBe(readFileSync(plan, 'utf8'));
    // Copied, not moved: the plan is still where it was.
    expect(existsSync(plan)).toBe(true);
  });

  /* Re-attached twice keeps both: either might be the one wanted back. */
  it('never writes over a copy it already made', () => {
    const plan = aPlan();
    const now = new Date('2026-09-09T10:00:00.000Z');
    const first = keepPreviousAttachment(plan, now);
    const second = keepPreviousAttachment(plan, now);
    made.push(first, second);
    expect(second).not.toBe(first);
    expect(existsSync(first)).toBe(true);
    expect(existsSync(second)).toBe(true);
  });
});
