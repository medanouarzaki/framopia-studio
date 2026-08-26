import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';
import { runImageProbe } from './drive.js';

/**
 * Free and local. Runs on the project `npm run build:comp` left open, so the
 * card and the image land in one master comp.
 *
 * It exists as a command rather than a one-off because the claim it settles —
 * that a solid IMG_MAIN accepts a replaced source — is about After Effects,
 * not about this repo, and has to be re-checkable on another machine and
 * another AE version.
 */
function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const imagePath = flag('image');
const masterName = flag('master');
if (imagePath === undefined || masterName === undefined) {
  console.error(
    'usage: npm run probe:image -- --image <abs path> --master <comp name> ' +
      '[--template img_float] [--at <seconds>]',
  );
  process.exit(1);
}

const templateId = flag('template') ?? 'img_float';
const at = Number(flag('at') ?? 14.309);

const result = runImageProbe({
  templateId,
  placeholder: 'IMG_MAIN',
  instanceName: `${templateId}__${path.basename(imagePath).replace(/\.[^.]+$/, '')}`,
  masterName,
  imagePath,
  inPointS: at,
  outPointS: at + 1.01,
  positionX: 1080,
  positionY: 900,
  parkAtS: at + 0.57,
  savePath: flag('out') ?? path.join(REPO_ROOT, '.local', 'build', 'vitasilk-probe.aep'),
});

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
