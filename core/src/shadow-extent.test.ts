import { describe, expect, it } from 'vitest';
import { loadTemplateAudit, shadowDescentPx } from './shadow-extent.js';
import { loadTemplateManifest, type Audit, type TemplateManifest } from './templates.js';

const manifest = loadTemplateManifest();
const audit = loadTemplateAudit();

function withoutShadowDeclarations(m: TemplateManifest): TemplateManifest {
  return {
    ...m,
    templates: m.templates.map((t) => {
      const copy = { ...t };
      delete (copy as { shadowLayers?: string[] }).shadowLayers;
      return copy;
    }),
  };
}

function withoutOffsets(a: Audit): Audit {
  return {
    ...a,
    comps: (a.comps ?? []).map((c) => ({
      ...c,
      layers: c.layers.map((l) => {
        const copy = { ...l };
        delete copy.effectOffsets;
        return copy;
      }),
    })),
  };
}

/**
 * The shadow is displaced by a Transform effect, which neither the layer's own
 * position nor `sourceRectAtTime` can see — Block 9 session 10 tried to measure
 * the rendered result and got the comp's rectangle. The audit is where the
 * figure lives, and this is what reads it.
 */
describe('shadowDescentPx', () => {
  it('reads the real templates’ offset out of the audit', () => {
    expect(shadowDescentPx(manifest, audit)).toBeCloseTo(15, 6);
  });

  /* A library with no declared shadow derives exactly the band it always did. */
  it('is zero when nothing declares a shadow', () => {
    expect(shadowDescentPx(withoutShadowDeclarations(manifest), audit)).toBe(0);
  });

  it('is zero for a comp the audit does not have', () => {
    expect(shadowDescentPx(manifest, { ok: true, comps: [] })).toBe(0);
  });

  /*
   * The one case worth naming: an audit predating `effectOffsets` reports zero,
   * which is indistinguishable from a shadow that does not move. The defence is
   * that `validateTemplates` refuses an audit whose sha256 does not match the
   * .aep, so a stale one cannot reach a build in the first place.
   */
  it('is zero for an audit taken before offsets were recorded', () => {
    expect(shadowDescentPx(manifest, withoutOffsets(audit))).toBe(0);
  });

  it('follows the file rather than a constant', () => {
    const deeper: Audit = {
      ...audit,
      comps: (audit.comps ?? []).map((c) => ({
        ...c,
        layers: c.layers.map((l) => ({
          ...l,
          effectOffsets: (l.effectOffsets ?? []).map((e) => ({
            ...e,
            offset: [e.offset?.[0] ?? 0, 40] as [number, number],
          })),
        })),
      })),
    };

    expect(shadowDescentPx(manifest, deeper)).toBe(40);
  });

  /* Downward only: the band is full frame width, so sideways does not enter. */
  it('ignores a shadow that only moves sideways', () => {
    const sideways: Audit = {
      ...audit,
      comps: (audit.comps ?? []).map((c) => ({
        ...c,
        layers: c.layers.map((l) => ({
          ...l,
          effectOffsets: (l.effectOffsets ?? []).map((e) => ({
            ...e,
            offset: [99, 0] as [number, number],
          })),
        })),
      })),
    };

    expect(shadowDescentPx(manifest, sideways)).toBe(0);
  });
});
