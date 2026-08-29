import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';
import { BUILD_STAGES, BUILD_STAGE_IDS, BUILD_STAGE_MARKER, parseBuildStage } from './stages.js';
import { buildCommand, failureMessage, progressPercent, readSavePath, readSavedOwnOutput, BUILD_CLI } from './job.js';
import { buildOutputPath } from '../steps.js';

/*
 * The panel and a terminal run the same file, so the thing worth pinning is
 * that they still do. If this ever spawns something else, the two can drift the
 * way the dry run and the runner did.
 */
describe('the build the panel runs', () => {
  it('is the compiled build-reel CLI, with the plan and mode as flags', () => {
    expect(BUILD_CLI).toBe(
      path.join(REPO_ROOT, 'service', 'dist', 'build', 'build-reel-cli.js'),
    );
    expect(buildCommand('/p.json')).toEqual([BUILD_CLI, '--plan', '/p.json']);
    expect(buildCommand('/p.json', 'k2-syndicalia')).toEqual([
      BUILD_CLI, '--plan', '/p.json', '--mode', 'k2-syndicalia',
    ]);
  });

  /*
   * Guidelines §3: a rule with two implementations is pinned by a test. The
   * stage ids live in stages.ts and the CLI has to emit every one of them, or
   * the panel shows a stage that never starts.
   */
  it('emits every declared stage from the CLI, in order', () => {
    const cli = readFileSync(
      path.join(REPO_ROOT, 'service', 'src', 'build', 'build-reel-cli.ts'),
      'utf8',
    );
    const emitted = [...cli.matchAll(/emitBuildStage\('([a-z-]+)'\)/g)].map((m) => m[1]);
    expect(emitted).toEqual([...BUILD_STAGE_IDS]);
  });

  it('reads a stage marker and ignores anything else on stdout', () => {
    expect(parseBuildStage(`${BUILD_STAGE_MARKER}after-effects`)).toBe('after-effects');
    expect(parseBuildStage(`${BUILD_STAGE_MARKER}nonsense`)).toBeNull();
    expect(parseBuildStage('watermark: medium, top-right')).toBeNull();
  });

  it('counts progress by finished stages', () => {
    const stages = BUILD_STAGES.map((s) => ({ ...s, state: 'waiting' as const }));
    expect(progressPercent(stages)).toBe(0);
    expect(progressPercent(stages.map((s, i) => ({ ...s, state: i === 0 ? 'done' : 'waiting' })))).toBeCloseTo(1 / 3, 9);
  });
});

/*
 * The refusal a person has to act on — most often the unsaved-changes guard —
 * reaches the panel as its own sentence rather than as an exit code.
 */
describe('what the panel is told when a build fails', () => {
  it('picks the builder’s refusal out of stderr', () => {
    const stderr =
      'some noise\n' +
      'build refused at start: the open After Effects project has unsaved changes: ' +
      '/Users/x/thing.aep. This will not close it. Save or close it yourself, then run it again.\n';
    expect(failureMessage(stderr, 1)).toContain('unsaved changes');
    expect(failureMessage(stderr, 1)).toContain('Save or close it yourself');
  });

  it('takes a thrown error’s message over the stack and the Node banner', () => {
    const stderr =
      'file:///x/io.js:43\n        throw new EditPlanVersionError(version);\n\n' +
      'EditPlanVersionError: edit plan schemaVersion 999 is not supported\n' +
      '    at readEditPlan (file:///x/io.js:43:15)\n\nNode.js v24.14.1\n';
    expect(failureMessage(stderr, 1)).toBe(
      'EditPlanVersionError: edit plan schemaVersion 999 is not supported',
    );
  });

  it('falls back to the last thing said, never to a bare code', () => {
    expect(failureMessage('the built comp does not match the plan\n', 1)).toBe(
      'the built comp does not match the plan',
    );
    expect(failureMessage('', 1)).toContain('said nothing');
  });
});

describe('what the panel is told when a build succeeds', () => {
  const stdout = `
watermark: medium, top-right, 324 x 363 px

{
  "ok": true,
  "savedOwnOutput": "/Volumes/T7 Shield/x/.local/build/vitasilk-full.aep",
  "savePath": "/Volumes/T7 Shield/x/.local/build/vitasilk-full.aep",
  "layers": 55
}

build wall clock 1.3s
`;
  it('names the file that was written, read from the result and not from prose', () => {
    expect(readSavePath(stdout)).toBe('/Volumes/T7 Shield/x/.local/build/vitasilk-full.aep');
    expect(readSavedOwnOutput(stdout)).toContain('vitasilk-full.aep');
    expect(readSavePath('nothing here')).toBeNull();
  });
});

/*
 * The preview tells the user where the file will land, and the builder decides
 * where it actually lands. Two implementations of one rule.
 */
describe('the output path the preview promises', () => {
  it('is the one the builder computes, spaces and all', () => {
    const cli = readFileSync(
      path.join(REPO_ROOT, 'service', 'src', 'build', 'build-reel-cli.ts'),
      'utf8',
    );
    expect(cli).toContain("path.join(REPO_ROOT, '.local', 'build', `${reel}-full.aep`)");
    expect(cli).toContain(".replace('.editplan.json', '').replace(/\\s+/g, '_')");
    expect(buildOutputPath('/a/b/test 1.editplan.json')).toBe(
      path.join(REPO_ROOT, '.local', 'build', 'test_1-full.aep'),
    );
  });
});
