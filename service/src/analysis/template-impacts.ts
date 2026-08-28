import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { impactFrameOf, REPO_ROOT, type AuditComp } from '@framopia/core';

/** 30000/1001. */
const FPS = 30000 / 1001;

/**
 * Each template's measured impact frame, read from the audit on disk.
 *
 * A template whose impact cannot be derived is **absent from the map**, not
 * zero: `deriveSfxEvents` falls back to the manifest offset for it, which is
 * the old rule rather than a guess. An audit that records keyframe counts
 * without their times — every audit before Block 8 session 21 — yields an empty
 * map and changes nothing.
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
    const derived = impactFrameOf(comp, FPS);
    if (derived.impactS !== null) impacts.set(comp.name, derived.impactS);
  }
  return impacts;
}
