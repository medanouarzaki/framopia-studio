/**
 * The change surface a plan migration is allowed to have.
 *
 * A migration writes to the artifact everything downstream is built on, so it
 * asserts what it touched rather than intending it: the file is compared before
 * and after, and a key outside the allowed set is a refusal, not a warning.
 * `repair-source-text` wrote nine values from the wrong draft into a committed
 * plan while reporting `343/343 correct`, which is what this is for.
 *
 * Shared by every migration that has one, so the rule cannot drift between two
 * copies of it.
 */
export function assertOnlyChangedKeys(
  before: string,
  after: string,
  allowed: ReadonlySet<string>,
  planPath: string,
): void {
  const a = JSON.parse(before) as Record<string, unknown>;
  const b = JSON.parse(after) as Record<string, unknown>;
  const changed = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(
    (k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]),
  );
  const illegal = changed.filter((k) => !allowed.has(k));
  if (illegal.length > 0) {
    throw new Error(
      `${planPath}: this migration may only change ${[...allowed].join(', ')}, ` +
        `and it changed ${illegal.join(', ')}`,
    );
  }
}
