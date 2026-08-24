import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURES_DIR } from './paths.js';
import { requiresConfirmation, runBenchmark } from './run.js';

describe('requiresConfirmation', () => {
  it('never prompts during a dry run', () => {
    expect(requiresConfirmation(true, 5, false)).toBe(false);
  });

  it('never prompts when the estimated cost is zero', () => {
    expect(requiresConfirmation(false, 0, false)).toBe(false);
  });

  it('skips the prompt when --yes is passed', () => {
    expect(requiresConfirmation(false, 5, true)).toBe(false);
  });

  it('requires confirmation for a billable, non-dry, non-yes run', () => {
    expect(requiresConfirmation(false, 5, false)).toBe(true);
  });
});

describe('runBenchmark --dry-run', () => {
  let resultsRoot: string;

  beforeEach(() => {
    resultsRoot = mkdtempSync(path.join(tmpdir(), 'framopia-bench-results-'));
  });

  afterEach(() => {
    rmSync(resultsRoot, { recursive: true, force: true });
  });

  it('omits WER columns and still reports when no ground truth is given', async () => {
    const resultsDir = await runBenchmark({
      audioPath: 'unused-in-dry-run.wav',
      groundTruthPath: null,
      engines: ['scribe'],
      keyterms: [],
      yes: false,
      dryRun: true,
      resultsRoot,
    });

    const report = readFileSync(path.join(resultsDir, 'report.md'), 'utf8');
    expect(report).not.toContain('overall WER');
    expect(report).toContain('orthography');
    expect(report).toContain('## Transcripts');
    expect(existsSync(path.join(resultsDir, 'scribe.txt'))).toBe(true);
  });

  it('produces a report.md and per-engine result files with no network calls', async () => {
    const resultsDir = await runBenchmark({
      audioPath: 'unused-in-dry-run.wav',
      groundTruthPath: path.join(FIXTURES_DIR, 'ground-truth.json'),
      engines: ['scribe', 'gemini', 'whisper', 'hybrid'],
      keyterms: [],
      yes: false,
      dryRun: true,
      resultsRoot,
    });

    expect(existsSync(path.join(resultsDir, 'report.md'))).toBe(true);
    expect(existsSync(path.join(resultsDir, 'scribe.json'))).toBe(true);
    expect(existsSync(path.join(resultsDir, 'gemini.json'))).toBe(true);
    expect(existsSync(path.join(resultsDir, 'whisper.json'))).toBe(true);
    expect(existsSync(path.join(resultsDir, 'hybrid.json'))).toBe(true);

    const report = readFileSync(path.join(resultsDir, 'report.md'), 'utf8');
    expect(report).toContain('| scribe |');
    expect(report).toContain('| gemini |');
    expect(report).toContain('| whisper |');
    expect(report).toContain('| hybrid |');
  });

  it('writes the per-run spotcheck but never touches the stable mirror', async () => {
    const resultsDir = await runBenchmark({
      audioPath: 'unused-in-dry-run.wav',
      groundTruthPath: path.join(FIXTURES_DIR, 'ground-truth.json'),
      engines: ['scribe'],
      keyterms: [],
      yes: false,
      dryRun: true,
      resultsRoot,
    });

    expect(existsSync(path.join(resultsDir, 'spotcheck-scribe.html'))).toBe(true);
    expect(existsSync(path.join(resultsRoot, 'latest-spotcheck'))).toBe(false);
  });

  it('writes spotcheck HTML for every timestamp-bearing engine', async () => {
    const resultsDir = await runBenchmark({
      audioPath: 'unused-in-dry-run.wav',
      groundTruthPath: path.join(FIXTURES_DIR, 'ground-truth.json'),
      engines: ['scribe', 'gemini', 'whisper', 'hybrid'],
      keyterms: [],
      yes: false,
      dryRun: true,
      resultsRoot,
    });

    expect(existsSync(path.join(resultsDir, 'spotcheck-scribe.html'))).toBe(true);
    expect(existsSync(path.join(resultsDir, 'spotcheck-whisper.html'))).toBe(true);
    expect(existsSync(path.join(resultsDir, 'spotcheck-hybrid.html'))).toBe(true);
    expect(existsSync(path.join(resultsDir, 'spotcheck-gemini.html'))).toBe(true);
  });

  it('runs a single-engine subset when --engines is restricted', async () => {
    const resultsDir = await runBenchmark({
      audioPath: 'unused-in-dry-run.wav',
      groundTruthPath: path.join(FIXTURES_DIR, 'ground-truth.json'),
      engines: ['whisper'],
      keyterms: [],
      yes: false,
      dryRun: true,
      resultsRoot,
    });

    expect(existsSync(path.join(resultsDir, 'whisper.json'))).toBe(true);
    expect(existsSync(path.join(resultsDir, 'scribe.json'))).toBe(false);
  });

  it('never calls the confirm callback in dry-run mode', async () => {
    let called = false;
    await runBenchmark({
      audioPath: 'unused-in-dry-run.wav',
      groundTruthPath: path.join(FIXTURES_DIR, 'ground-truth.json'),
      engines: ['scribe'],
      keyterms: [],
      yes: false,
      dryRun: true,
      resultsRoot,
      confirm: async () => {
        called = true;
        return true;
      },
    });
    expect(called).toBe(false);
  });
});

describe('runBenchmark --dry-run cost estimate', () => {
  let resultsRoot: string;

  beforeEach(() => {
    resultsRoot = mkdtempSync(path.join(tmpdir(), 'framopia-bench-results-'));
  });

  afterEach(() => {
    rmSync(resultsRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('prices a dry run from the real input duration, not the fixture span', async () => {
    const mediaPath = path.join(resultsRoot, 'reel.mov');
    writeFileSync(mediaPath, '');
    const probed: string[] = [];
    const logged: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logged.push(args.join(' '));
    });

    await runBenchmark({
      audioPath: mediaPath,
      groundTruthPath: null,
      engines: ['scribe'],
      keyterms: [],
      yes: false,
      dryRun: true,
      resultsRoot,
      probeDurationS: async (p) => {
        probed.push(p);
        return 25.692333;
      },
    });

    expect(probed).toEqual([mediaPath]);
    expect(logged[0]).toContain('25.7s');
    // 25.692333s at $0.22/audio-hour, four decimal places.
    expect(logged.join('\n')).toContain('scribe: $0.0016');
  });

  it('falls back to the fixture span when the input does not exist', async () => {
    const logged: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logged.push(args.join(' '));
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await runBenchmark({
      audioPath: 'unused-in-dry-run.wav',
      groundTruthPath: null,
      engines: ['scribe'],
      keyterms: [],
      yes: false,
      dryRun: true,
      resultsRoot,
      probeDurationS: async () => {
        throw new Error('probe must not run without a real file');
      },
    });

    expect(logged[0]).toContain('1.1s');
  });
});
