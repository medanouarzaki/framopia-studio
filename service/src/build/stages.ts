/**
 * The build's stages, declared once and emitted by the build itself.
 *
 * The panel drives the build by spawning `build-reel-cli.ts` — the same file
 * `npm run build:reel` runs — so the only honest source of progress is the
 * build's own output. Guessing at it by matching English prose would break
 * silently the next time a sentence is reworded, so the CLI emits a marker per
 * stage and both sides import these ids. `stages.test.ts` pins that the CLI
 * emits every one of them, in this order.
 *
 * Markers are printed **only when `FRAMOPIA_BUILD_STAGES` is set**, which the
 * job sets and a terminal does not, so what a person sees on stdout is exactly
 * what it has always been.
 */
export const BUILD_STAGE_IDS = ['prepare', 'after-effects', 'check'] as const;
export type BuildStageId = (typeof BUILD_STAGE_IDS)[number];

export interface BuildStageSpec {
  id: BuildStageId;
  /** The words the panel shows. */
  label: string;
}

export const BUILD_STAGES: readonly BuildStageSpec[] = [
  { id: 'prepare', label: 'Read the plan and resolve everything it names' },
  { id: 'after-effects', label: 'Build the composition in After Effects' },
  { id: 'check', label: 'Check the built comp against the plan' },
];

export const BUILD_STAGE_MARKER = '##framopia-build-stage ';

/** Set by the job; unset in a terminal, where these lines would be noise. */
export const BUILD_STAGES_ENV = 'FRAMOPIA_BUILD_STAGES';

export function emitBuildStage(id: BuildStageId): void {
  if (process.env[BUILD_STAGES_ENV] !== '1') return;
  process.stdout.write(`${BUILD_STAGE_MARKER}${id}\n`);
}

export function parseBuildStage(line: string): BuildStageId | null {
  if (!line.startsWith(BUILD_STAGE_MARKER)) return null;
  const id = line.slice(BUILD_STAGE_MARKER.length).trim();
  return (BUILD_STAGE_IDS as readonly string[]).includes(id) ? (id as BuildStageId) : null;
}
