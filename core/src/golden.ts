/**
 * The comparison the second machine is measured against.
 *
 * A build is deterministic here. Twenty-four builds of four reels, censused
 * immediately after each, in two passes of twelve: **exactly two fields moved,
 * and they moved on every reel**. Everything else — every card's text, font,
 * size, shrink factor, position, scale, audio level, layer count and the file
 * behind every picture — was identical across all three runs of every reel. So
 * a census taken on another Mac either matches this one field for field or
 * names exactly where the two After Effects disagree, which is the whole
 * question Block 10 exists to answer.
 *
 * The comparison is pure and lives here so `npm run check` runs it: the harness
 * in `tools/golden/` builds and censuses, and does no deciding.
 *
 * **Two of the excluded fields were excluded by ruling rather than by
 * measurement**, and the list says which is which. `aeVersion` and
 * `fontNameCount` describe the machine that took the census, not the comp it
 * built: the partner's After Effects will very likely be a different build and
 * his font library certainly is, so comparing them would fail his first run on
 * two facts that say nothing about whether the system works. They are recorded
 * as run inputs and printed on both sides of any difference, where context
 * belongs. What replaced `fontNameCount` as a check is the face set on every
 * individual text layer, which was always the one that mattered.
 */

/** The reels the golden run covers. */
export const GOLDEN_REELS = ['test-1', 'test-2', 'test-3', 'vitasilk'] as const;
export type GoldenReel = (typeof GOLDEN_REELS)[number];

/**
 * `ground-truth` is deliberately absent.
 *
 * Its six image slots were planned but never generated — the image service has
 * answered with a capacity error since Block 10 session 7 — so it refuses at
 * pre-flight with `UnplaceableElementsError` and there is no comp to census. It
 * joins the set when the pictures exist, which is a spending decision.
 */
export const GOLDEN_REELS_EXCLUDED = {
  'ground-truth': 'six image slots planned with no candidates; refuses at pre-flight',
} as const;

export interface ExcludedField {
  readonly path: string;
  /** Why it cannot be compared, in one line. */
  readonly reason: string;
  /** What it was observed to take, so the exclusion can be re-judged. */
  readonly observed: string;
  /** Builds behind the observation, or 0 for a field excluded by ruling. */
  readonly runs: number;
  /**
   * `measured` — it moved between builds here, so comparing it is noise.
   * `not-about-the-comp` — it describes the machine, not what was built, so a
   * difference says nothing about whether the system works. A ruling, and each
   * one names what still covers the ground it left.
   */
  readonly because: 'measured' | 'not-about-the-comp';
}

/**
 * Excluded because measured to vary, and for no other reason.
 *
 * Block 10 session 14 built each of the four reels three times, censusing each
 * build immediately, and diffed the three censuses of each reel field by field.
 * It did that twice: once on the census as it stood, and again after the census
 * learned to record which picture each image slot places. **Both passes found
 * exactly these two fields, on every reel** — 51,558 field readings in the
 * second pass, 8 of them varying.
 *
 * Nothing is excluded on the grounds that another machine might differ. That is
 * the difference this exists to find.
 */
export const GOLDEN_EXCLUDED_FIELDS: readonly ExcludedField[] = [
  {
    path: 'measuredAt',
    reason: 'the wall clock when the census ran',
    observed: '02:25:14.137Z, 02:25:32.804Z, 02:25:50.426Z on test-1',
    runs: 24,
    because: 'measured',
  },
  {
    path: 'aepSha256',
    reason:
      'After Effects embeds a timestamp in the project file, so two builds of ' +
      'one comp never have the same bytes',
    observed: '6f39b804…, 4614e47e…, b127023b… on test-1',
    runs: 24,
    because: 'measured',
  },
  {
    path: 'aeVersion',
    reason:
      'which After Effects took the measurement, not what it built; a different ' +
      'build laying out identical comps is a pass, and it is printed on both sides',
    observed: '26.0x67 here; the second machine will very likely differ',
    runs: 0,
    because: 'not-about-the-comp',
  },
  {
    path: 'fontNameCount',
    reason:
      'how many faces are installed on the machine, which no comp depends on; ' +
      'the face set on every text layer is compared and is the check that matters',
    observed: '1198 here; any machine with different fonts installed differs',
    runs: 0,
    because: 'not-about-the-comp',
  },
];

/**
 * Fields holding an absolute path, normalised to repo-relative rather than
 * excluded.
 *
 * The repository can live in any folder since session 11, so a path differing
 * only by its root is equal — and a path differing in any other way is a real
 * difference that must still fail.
 */
export const GOLDEN_PATH_FIELDS = ['aepPath', 'sourceFile'] as const;

export interface FieldDifference {
  readonly path: string;
  readonly expected: unknown;
  readonly actual: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function relativise(value: string, repoRoot: string): string {
  if (!value.startsWith(repoRoot)) return value;
  const tail = value.slice(repoRoot.length);
  return tail.startsWith('/') ? tail.slice(1) : tail;
}

/**
 * A census with the excluded fields dropped and every path made repo-relative.
 *
 * Key order is not preserved deliberately — the comparison walks by key, so two
 * censuses that differ only in the order their keys were written are equal.
 */
export function normaliseCensus(census: unknown, repoRoot: string): unknown {
  const excluded = new Set(GOLDEN_EXCLUDED_FIELDS.map((f) => f.path));
  const pathFields = new Set<string>(GOLDEN_PATH_FIELDS);

  const walk = (value: unknown, key: string | null): unknown => {
    if (Array.isArray(value)) return value.map((v) => walk(v, key));
    if (isRecord(value)) {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(value).sort()) {
        if (excluded.has(k)) continue;
        out[k] = walk(value[k], k);
      }
      return out;
    }
    if (typeof value === 'string' && key !== null && pathFields.has(key)) {
      return relativise(value, repoRoot);
    }
    return value;
  };
  return walk(census, null);
}

/**
 * Every field that differs, by path, with both values.
 *
 * A count is not a finding: session 13 fixed the same shape in the references
 * gate, where a number on screen could mean two things. A reader gets the path
 * and both values or the run has told them nothing.
 */
export function compareCensus(expected: unknown, actual: unknown, prefix = ''): FieldDifference[] {
  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual)) {
      return [{ path: prefix, expected, actual }];
    }
    const out: FieldDifference[] = [];
    if (expected.length !== actual.length) {
      out.push({ path: `${prefix}.length`, expected: expected.length, actual: actual.length });
    }
    for (let i = 0; i < Math.min(expected.length, actual.length); i += 1) {
      out.push(...compareCensus(expected[i], actual[i], `${prefix}[${i}]`));
    }
    return out;
  }
  if (isRecord(expected) || isRecord(actual)) {
    if (!isRecord(expected) || !isRecord(actual)) {
      return [{ path: prefix, expected, actual }];
    }
    const out: FieldDifference[] = [];
    for (const key of [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort()) {
      const at = prefix === '' ? key : `${prefix}.${key}`;
      if (!(key in expected)) {
        out.push({ path: at, expected: '<absent>', actual: actual[key] });
        continue;
      }
      if (!(key in actual)) {
        out.push({ path: at, expected: expected[key], actual: '<absent>' });
        continue;
      }
      out.push(...compareCensus(expected[key], actual[key], at));
    }
    return out;
  }
  if (!Object.is(expected, actual)) return [{ path: prefix, expected, actual }];
  return [];
}

export const GOLDEN_SCHEMA_VERSION = 1;

export interface GoldenReference {
  readonly schemaVersion: number;
  /** What produced it, for a reader who finds the file alone. */
  readonly recordedBy: string;
  readonly recordedAt: string;
  /**
   * The machine, not the comp. `aeVersion` and `fontNames` live here rather
   * than in the compared fields: see {@link GOLDEN_EXCLUDED_FIELDS}.
   */
  readonly recordedOn: {
    machine: string;
    aeVersion: string;
    /** Optional with a default: a reference recorded before session 15 has none. */
    fontNames?: number | null;
    commit: string;
  };
  readonly excluded: readonly ExcludedField[];
  /** Reel to its normalised census. */
  readonly reels: Record<string, unknown>;
}

export class GoldenReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoldenReferenceError';
  }
}

/**
 * Parses a reference, or throws saying what is wrong with it.
 *
 * A missing or malformed reference is a stated failure and never a silent pass:
 * a comparison against nothing passes trivially, which is the failure mode that
 * makes a check decorative.
 */
export function parseGoldenReference(input: unknown, source: string): GoldenReference {
  if (!isRecord(input)) throw new GoldenReferenceError(`${source} is not an object`);
  const version = input['schemaVersion'];
  if (version !== GOLDEN_SCHEMA_VERSION) {
    throw new GoldenReferenceError(
      `${source} has schemaVersion ${String(version)}; this build reads ${GOLDEN_SCHEMA_VERSION}`,
    );
  }
  const reels = input['reels'];
  if (!isRecord(reels)) throw new GoldenReferenceError(`${source} has no reels object`);
  for (const reel of GOLDEN_REELS) {
    if (!(reel in reels)) {
      throw new GoldenReferenceError(`${source} has no census for ${reel}`);
    }
  }
  return input as unknown as GoldenReference;
}

/** How many leaf readings a census carries, so a match reports its own weight. */
export function countFields(value: unknown): number {
  if (Array.isArray(value)) return value.reduce<number>((n, v) => n + countFields(v), 0);
  if (isRecord(value)) return Object.values(value).reduce<number>((n, v) => n + countFields(v), 0);
  return 1;
}

export function excludedFieldsSummary(
  fields: readonly ExcludedField[] = GOLDEN_EXCLUDED_FIELDS,
): string[] {
  return fields.map((f) =>
    f.because === 'measured'
      ? `${f.path} — ${f.reason}; measured varying across ${f.runs} builds (${f.observed})`
      : `${f.path} — ${f.reason}; recorded as a run input instead (${f.observed})`,
  );
}
