import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './paths.js';
import type { Audit, AuditComp, TemplateManifest } from './templates.js';

/**
 * How far a template's shadow layer reaches past the word it sits behind.
 *
 * The user's shadow is a duplicate of the text layer displaced by a **Transform
 * effect**, so neither the layer's own position nor `sourceRectAtTime` can see
 * it — an effect is applied after the source rect is taken. Block 9 session 10
 * tried to measure the rendered result and got the comp's rectangle instead;
 * a rendered extent is not obtainable this way and this project never renders.
 *
 * **It does not need to be.** The displacement is in the audit, and the Fast
 * Box Blur that softens it animates from 30 to 0 across the entrance — so at
 * rest, which is what the band has to clear, the offset is the whole of the
 * shadow's reach. The blur's spread exists only while the card is arriving, and
 * it is on the visible layer too, so it is not a shadow-specific term.
 *
 * Downward only: the band's bottom is what a shadow offset down extends past.
 * The horizontal offset does not enter, because the band is full frame width.
 */
export const TEMPLATE_AUDIT_PATH = path.join(REPO_ROOT, 'templates', 'library.audit.json');

export function loadTemplateAudit(auditPath = TEMPLATE_AUDIT_PATH): Audit {
  return JSON.parse(readFileSync(auditPath, 'utf8')) as Audit;
}

/**
 * The largest downward displacement among every declared shadow layer.
 *
 * **Zero when nothing declares a shadow**, which is what every template looked
 * like before Block 9 session 10 — so a library without one derives the band it
 * always did. Zero is also what an audit predating `effectOffsets` yields, and
 * that is the one case worth naming: it is indistinguishable from a shadow that
 * genuinely does not move, and the only defence is that `validateTemplates`
 * refuses an audit whose sha256 does not match the `.aep`.
 */
export function shadowDescentPx(manifest: TemplateManifest, audit: Audit): number {
  const comps = new Map<string, AuditComp>((audit.comps ?? []).map((c) => [c.name, c]));
  let deepest = 0;
  for (const template of manifest.templates) {
    const shadows = template.shadowLayers ?? [];
    if (shadows.length === 0) continue;
    const comp = comps.get(template.id);
    if (comp === undefined) continue;
    for (const layer of comp.layers) {
      if (!shadows.includes(layer.name)) continue;
      for (const effect of layer.effectOffsets ?? []) {
        const down = effect.offset?.[1];
        if (typeof down === 'number' && down > deepest) deepest = down;
      }
    }
  }
  return deepest;
}
