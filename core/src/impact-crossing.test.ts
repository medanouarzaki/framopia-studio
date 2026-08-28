import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DOCS_DIR } from './paths.js';
import { crossingsOf, crossingTime, impactCrossingOf } from './impact-crossing.js';
import { IMPACT_THRESHOLD } from './impact-frame.js';
import type { AuditComp } from './templates.js';

const FPS = 30000 / 1001;
const AUDIT = JSON.parse(
  readFileSync(path.join(DOCS_DIR, '..', 'templates', 'library.audit.json'), 'utf8'),
) as { comps: AuditComp[] };

const compOf = (name: string): AuditComp =>
  AUDIT.comps.find((c) => c.name === name) as AuditComp;

describe('crossingTime', () => {
  /*
   * The straight case, where the answer is arithmetic: handles at zero
   * influence make the value bezier a straight line, so 95% of the way through
   * the value is 95% of the way through the time.
   */
  it('reduces to the linear answer when there is no easing to speak of', () => {
    const at = crossingTime({
      durationS: 1,
      deltaValue: 100,
      outEase: { influence: 0.01, speed: 100 },
      inEase: { influence: 0.01, speed: 100 },
      threshold: 0.95,
    });
    expect(at).toBeCloseTo(0.95, 2);
  });

  it('crosses earlier when the motion is front-loaded', () => {
    const eased = crossingTime({
      durationS: 1,
      deltaValue: 100,
      // The out-handle reaches the full delta a seventh of the way in, which is
      // what the templates do.
      outEase: { influence: 14, speed: 100 / 0.14 },
      inEase: { influence: 66, speed: 0 },
      threshold: 0.95,
    }) as number;
    expect(eased).toBeLessThan(0.95);
    expect(eased).toBeGreaterThan(0);
  });

  /* A null ease is not linear; AE refused to answer and that is not a zero. */
  it('returns null rather than assuming linear when an ease is missing', () => {
    expect(
      crossingTime({ durationS: 1, deltaValue: 100, outEase: null, inEase: { influence: 0, speed: 0 }, threshold: 0.95 }),
    ).toBeNull();
    expect(
      crossingTime({ durationS: 1, deltaValue: 100, outEase: { influence: 0, speed: null }, inEase: { influence: 0, speed: 0 }, threshold: 0.95 }),
    ).toBeNull();
  });

  it('returns null for a property that does not move', () => {
    expect(
      crossingTime({ durationS: 1, deltaValue: 0, outEase: { influence: 14, speed: 0 }, inEase: { influence: 66, speed: 0 }, threshold: 0.95 }),
    ).toBeNull();
  });
});

describe('the templates, measured from their own curves', () => {
  /*
   * Every comp the user built shares one easing preset, so every entrance
   * property crossing at the same frame is evidence the convention is being
   * read correctly rather than a coincidence.
   */
  it('gives 5.25 frames on every entrance property of every comp', () => {
    for (const comp of AUDIT.comps) {
      for (const crossing of crossingsOf(comp, FPS)) {
        expect(crossing.crossingFrames, `${comp.name} ${crossing.property}`).toBeCloseTo(5.25, 1);
      }
    }
  });

  it('is far from the linear reading, which is what the easing is worth', () => {
    const position = crossingsOf(compOf('kw_slam'), FPS).find(
      (c) => c.property === 'Transform/Position',
    );
    expect(position?.linearFrames).toBeCloseTo(11.4, 1);
    expect(position?.lastKeyFrames).toBeCloseTo(12, 1);
    expect(position?.crossingFrames).toBeLessThan(6);
  });

  /*
   * Scale reports one ease per dimension while Position reports one for the
   * path. Comparing a three-dimensional magnitude against dimension zero's
   * speed is a units error, and it put Scale at 7.27 frames where everything
   * else gave 5.25.
   */
  it('reads a per-dimension ease per dimension, and a spatial ease along the path', () => {
    const scale = crossingsOf(compOf('img_float'), FPS).find(
      (c) => c.property === 'Transform/Scale',
    );
    expect(scale?.crossingFrames).toBeCloseTo(5.25, 1);
  });

  it('takes the latest crossing as the comp’s impact, so everything has arrived', () => {
    const impact = impactCrossingOf(compOf('kw_slam'), FPS);
    expect(impact.impactS).not.toBeNull();
    expect((impact.impactS as number) * FPS).toBeCloseTo(5.25, 1);
    expect(impact.from).not.toBeNull();
  });

  /**
   * **The check against the user's eye, and it does not pass.**
   *
   * He built these templates and says `kw_slam`'s word lands at frame 4. The
   * curve at `IMPACT_THRESHOLD` = 0.95 crosses at 5.25, and frame 4 corresponds
   * to a threshold of 0.8966. The convention is right — nothing else explains
   * six comps agreeing, or the distance from linear's 11.40 — and **the
   * threshold is what disagrees**. Nothing was migrated onto 5.25.
   *
   * This test states the disagreement rather than asserting the number is
   * correct, so it cannot quietly become the record.
   */
  it('does not yet agree with the user’s frame 4, and the threshold is the reason', () => {
    const position = crossingsOf(compOf('kw_slam'), FPS).find(
      (c) => c.property === 'Transform/Position',
    ) as { crossingFrames: number };
    expect(IMPACT_THRESHOLD).toBe(0.95);
    expect(position.crossingFrames).toBeCloseTo(5.25, 1);
    expect(Math.abs(position.crossingFrames - 4)).toBeGreaterThan(1);

    const atUsersFrame = crossingsOf(compOf('kw_slam'), FPS, 0.8966).find(
      (c) => c.property === 'Transform/Position',
    );
    expect(atUsersFrame?.crossingFrames).toBeCloseTo(4, 1);
  });
});
