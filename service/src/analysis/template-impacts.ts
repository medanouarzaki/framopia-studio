import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { impactCrossingOf, REPO_ROOT, type AuditComp } from '@framopia/core';

/** 30000/1001. */
const FPS = 30000 / 1001;

/**
 * Each template's measured impact frame, read from the audit on disk.
 *
 * **The crossing, not the last keyframe.** `impactFrameOf` measures where the
 * entrance finishes *settling*; the easing front-loads the motion, so the word
 * arrives long before that and sound placed on the settle lands 8 frames late,
 * which the user heard. `impactCrossingOf` computes where the value first
 * reaches `IMPACT_THRESHOLD` from the interpolated curve, which needs the
 * easing the audit has recorded since Block 8 session 23.
 *
 * A template whose impact cannot be derived is **absent from the map**, not
 * zero: `deriveSfxEvents` falls back to the manifest offset for it, which is
 * the old rule rather than a guess. An audit that records keyframe counts
 * without their easing — every audit before Block 8 session 23 — yields an
 * empty map and changes nothing.
 */
export function templateImpacts(auditPath?: string): Map<string, number> {
  const file = auditPath ?? path.join(REPO_ROOT, 'templates', 'library.audit.json');
  const impacts = new Map<string, number>();
  if (!existsSync(file)) return impacts;

  let audit: { comps?: AuditComp[] };
  try {
    audit = JSON.parse(readFileSync(file, 'utf8')) as { comps?: AuditComp[] };
  } catch {
    return impacts;
  }

  for (const comp of audit.comps ?? []) {
    const derived = impactCrossingOf(comp, FPS);
    if (derived.impactS !== null) impacts.set(comp.name, derived.impactS);
  }
  return impacts;
}

/**
 * The image template's authored entrance, for callers that place a picture's
 * sound without a build's audit to hand. Zero when the audit cannot be read,
 * which is what `templateImpacts` does for the same reason.
 */
export function imageEntranceS(templateId = 'img_float', auditPath?: string): number {
  const file = auditPath ?? path.join(REPO_ROOT, 'templates', 'library.audit.json');
  if (!existsSync(file)) return 0;
  let audit: { comps?: AuditComp[] };
  try {
    audit = JSON.parse(readFileSync(file, 'utf8')) as { comps?: AuditComp[] };
  } catch {
    return 0;
  }
  const layer = (audit.comps ?? [])
    .find((c) => c.name === templateId)
    ?.layers.find((l) => l.name === 'IMG_MAIN');
  const last = layer?.animated?.find((a) => a.path === 'Transform/Opacity')?.keys?.slice(-1)[0]
    ?.time;
  return typeof last === 'number' && last > 0 ? last : 0;
}
