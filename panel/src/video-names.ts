/**
 * **A video's label, shortened for the place it is shown.**
 *
 * Block 13 session 99. Mohamed's labels average **44 characters** and read
 * `September Content/Exports/Work in Progress/sora-2`. In a list of fifteen he is
 * scanning fifteen near-identical strings whose only difference is the last four
 * characters — the exact confusion the labels exist to prevent.
 *
 * **The stored label does not change, and must not.** Block 12 session 81 made it
 * carry its folder always rather than only on a collision, because three of his
 * files are called `sora.mov` and a key that changed shape when a sibling
 * appeared would shift under him. Plans, cache keys and routes all hold it. This
 * is a different question: what a **row** shows, with the full label a hover
 * away.
 *
 * **The rule, and it cannot be ambiguous.** For each label, the shortest of:
 *
 * 1. the file's own name — `sora-2`, `MVI_9499`;
 * 2. the first folder with the middle elided — `August content/…/sora`;
 * 3. a longer suffix, one folder at a time;
 * 4. the whole label.
 *
 * whichever is first **unique among the labels being shown together**. It cannot
 * collide, because step 4 is the label itself and labels are unique by
 * construction — and `shortLabels` asserts that rather than assuming it.
 *
 * **The shown text depends on the set, on purpose.** If he adds a second
 * `sora-2`, both rows grow a folder — which is precisely the information he needs
 * at the moment he needs it. That is the opposite of the stored label, which must
 * never move.
 */

/** Every candidate for one label, shortest first. */
export function candidatesFor(label: string): string[] {
  const parts = label.split('/').filter((p) => p !== '');
  if (parts.length <= 1) return [label];
  const file = parts[parts.length - 1] as string;
  const out = [file];
  /* The first folder, with whatever is between it and the file left out. */
  if (parts.length >= 3) out.push(`${parts[0] as string}/…/${file}`);
  /* Then plain suffixes, one folder at a time, up to the whole thing. */
  for (let take = 2; take <= parts.length; take += 1) {
    out.push(parts.slice(parts.length - take).join('/'));
  }
  return [...new Set(out)];
}

/**
 * What each label should read as, shown together.
 *
 * Returns a map from the stored label to the text for a row. **No two labels map
 * to the same text**; if that were ever about to happen the whole label is used,
 * and the assertion below would be the thing that caught a rule gone wrong.
 */
export function shortLabels(labels: readonly string[]): Map<string, string> {
  const shown = new Map<string, string>();
  const taken = new Set<string>();

  /*
   * Longest first, so a label that needs its folders claims them before a
   * shorter neighbour takes the plain filename — otherwise which of two videos
   * got the short form would depend on the order they arrived in.
   */
  const order = [...labels].sort((a, b) => b.split('/').length - a.split('/').length || a.localeCompare(b));

  for (const label of order) {
    const others = labels.filter((l) => l !== label);
    const pick =
      candidatesFor(label).find((candidate) => {
        if (taken.has(candidate)) return false;
        /* Unique means no *other* label could also be shown this way. */
        return !others.some((other) => candidatesFor(other).includes(candidate));
      }) ?? label;
    shown.set(label, pick);
    taken.add(pick);
  }
  return shown;
}

/** One label on its own, with nothing to be confused with. */
export function shortLabel(label: string, among: readonly string[]): string {
  return shortLabels(among.includes(label) ? among : [...among, label]).get(label) ?? label;
}
