import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { MODES_DIR, parseMode, REPO_ROOT } from '@framopia/core';
import { loadReels as loadFootageReels } from './frames/footage.js';

/**
 * What the panel offers the user to pick from.
 *
 * It lives here rather than in the panel because the panel is a view: the rule
 * for where footage lives is `frames/footage.ts`, the rule for what a mode is
 * is `core/src/mode.ts`, and a second copy of either inside a React bundle is
 * a second place for them to drift. The panel asks over HTTP and renders the
 * answer.
 */
export interface CatalogueReel {
  label: string;
  videoPath: string;
  planPath: string | null;
  durationS: number | null;
  /** Cumulative spend from the plan's `costs.spentUsd`; null when no plan exists. */
  spentUsd: number | null;
  /** False when the catalogue lists it but the file is not on this machine. */
  present: boolean;
}

export interface CatalogueMode {
  id: string;
  name: string;
  version: number;
  fontsResolved: boolean;
}

function planPathFor(videoPath: string): string {
  return videoPath.replace(/\.[^.]+$/, '.editplan.json');
}

export function listReels(): CatalogueReel[] {
  return loadFootageReels().map((reel) => {
    const planPath = planPathFor(reel.path);
    const hasPlan = existsSync(planPath);
    let spentUsd: number | null = null;
    if (hasPlan) {
      try {
        const plan = JSON.parse(readFileSync(planPath, 'utf8')) as { costs?: { spentUsd?: number } };
        spentUsd = typeof plan.costs?.spentUsd === 'number' ? plan.costs.spentUsd : null;
      } catch {
        // A plan that will not parse is a problem for the stage that opens it,
        // not a reason to drop the reel from the picker.
        spentUsd = null;
      }
    }
    return {
      label: reel.label,
      videoPath: reel.path,
      planPath: hasPlan ? planPath : null,
      durationS: reel.durationS ?? null,
      spentUsd,
      present: existsSync(reel.path),
    };
  });
}

/**
 * Every mode in `modes/`, through the same parser `npm run validate:modes`
 * uses, so a mode the validator rejects does not silently appear in a picker.
 */
export function listModes(): CatalogueMode[] {
  if (!existsSync(MODES_DIR)) return [];
  return readdirSync(MODES_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .flatMap((file) => {
      const modePath = path.join(MODES_DIR, file);
      try {
        const mode = parseMode(readFileSync(modePath, 'utf8'), modePath);
        return [
          {
            id: mode.id,
            name: mode.name,
            version: mode.version,
            fontsResolved: mode.fonts.status === 'set',
          },
        ];
      } catch {
        return [];
      }
    });
}

export { REPO_ROOT };
