import path from 'node:path';
import {
  REPO_ROOT,
  SUBTITLE_ANCHOR_BASELINE_Y,
  SUBTITLE_ANCHOR_X,
  loadTemplateManifest,
  templatesById,
  type AuditLayer,
} from '@framopia/core';
import { readFileSync } from 'node:fs';
import { readEditPlan } from '../editplan/io.js';
import { runBuild, type BuildResult } from './drive.js';

/**
 * Places one subtitle card in a master comp and reports what After Effects
 * actually did. Free and local; it drives the running AE and touches no API.
 *
 * A probe, not the builder: one group, chosen by the caller, timed on its
 * speech window because no plan in the corpus stores display timing.
 */
const AUDIT_PATH = path.join(REPO_ROOT, 'templates', 'library.audit.json');
const AEP_PATH = path.join(REPO_ROOT, 'templates', 'library.aep');

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const planPath = flag('plan');
const groupId = flag('group');
if (planPath === undefined || groupId === undefined) {
  console.error(
    'usage: npm run build:comp -- --plan <abs path.editplan.json> --group <groupId> ' +
      '[--out <abs path.aep>] [--template <id>] [--placeholder <layer>] [--footage <abs path>]',
  );
  process.exit(1);
}

const plan = await readEditPlan(planPath);
const group = plan.subtitles.groups.find((g) => g.id === groupId);
if (group === undefined) {
  console.error(`build:comp: ${planPath} has no subtitle group "${groupId}"`);
  process.exit(1);
}

const templateId = flag('template') ?? group.templateId;
if (templateId === null || templateId === undefined) {
  console.error(`build:comp: group "${groupId}" carries no templateId; pass --template`);
  process.exit(1);
}
const entry = templatesById(loadTemplateManifest()).get(templateId);
const introS = entry?.introS ?? 0;

const placeholder = flag('placeholder') ?? 'TXT_MAIN';

/**
 * Geometry comes from the audit, which is the thing that read the AEP. The
 * settled value, not `value`: an animated property reports whatever sits under
 * the current time indicator, and sub_pop's TXT_MAIN animates y 750 -> 700.
 */
interface AuditFile {
  comps?: { name: string; width: number; height: number; layers: AuditLayer[] }[];
}
const audit = JSON.parse(readFileSync(AUDIT_PATH, 'utf8')) as AuditFile;
const templateComp = (audit.comps ?? []).find((c) => c.name === templateId);
if (templateComp === undefined) {
  console.error(`build:comp: ${AUDIT_PATH} has no comp "${templateId}". Run: npm run audit:templates`);
  process.exit(1);
}
const auditLayer = templateComp.layers.find((l) => l.name === placeholder);
const settled = auditLayer?.position?.valueAtSampleTime;
if (!Array.isArray(settled)) {
  console.error(
    `build:comp: comp "${templateId}" layer "${placeholder}" has no audited position. ` +
      'Run: npm run audit:templates (After Effects must be open)',
  );
  process.exit(1);
}
const [baselineX, baselineY] = settled as number[];
if (typeof baselineX !== 'number' || typeof baselineY !== 'number') {
  console.error(`build:comp: audited position for "${placeholder}" is not numeric`);
  process.exit(1);
}

// No plan stores display timing, so the probe is timed on speech. Stated in
// the report rather than hidden: it is a limitation of this instance, not a
// decision about how the builder will work.
const inPointS = group.start - introS;
const outPointS = group.end;
const text = group.wordIds
  .map((id) => plan.transcript.words.find((w) => w.id === id)?.text ?? '')
  .join(' ');

const savePath = flag('out') ?? path.join(REPO_ROOT, '.local', 'build', 'vitasilk-probe.aep');

console.log(`group ${group.id} "${text}" speech ${group.start}-${group.end}`);
console.log(`template ${templateId}, introS ${introS}`);
console.log(`retime: inPoint ${inPointS} = ${group.start} - ${introS}; outPoint ${outPointS}`);
console.log(
  `baseline in comp (audited, settled): [${baselineX}, ${baselineY}] ` +
    `inside ${templateComp.width}x${templateComp.height}`,
);
console.log(`target baseline in master (typography.ts): [${SUBTITLE_ANCHOR_X}, ${SUBTITLE_ANCHOR_BASELINE_Y}]`);

const result: BuildResult = runBuild({
  footagePath: flag('footage') ?? plan.source.videoPath,
  templatesAepPath: AEP_PATH,
  templateId,
  placeholder,
  instanceName: `${templateId}__${group.id}`,
  masterName: `master_${path.basename(planPath).replace('.editplan.json', '')}`,
  masterWidth: plan.source.width,
  masterHeight: plan.source.height,
  reelDurationS: plan.source.durationS,
  frameRate: 30000 / 1001,
  text,
  inPointS,
  outPointS,
  placeholderBaselineX: baselineX,
  placeholderBaselineY: baselineY,
  targetBaselineX: SUBTITLE_ANCHOR_X,
  targetBaselineY: SUBTITLE_ANCHOR_BASELINE_Y,
  parkAtS: (group.start + group.end) / 2,
  savePath,
});

console.log(`\n${JSON.stringify(result, null, 2)}`);
if (!result.ok) process.exit(1);
