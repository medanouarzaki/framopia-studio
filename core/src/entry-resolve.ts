import { ACTIVE_PROMPT_VERSION } from './prompt-version.js';
import type { CachedEntryDescriptor } from './cache-select.js';

/**
 * How a cache entry was found, and the whole vocabulary a tool is allowed to
 * use when it says so.
 *
 * `exact` — the fingerprint the current configuration computes names an entry
 * that is on disk. Nothing to explain.
 *
 * `compatible` — no exact match, but an entry exists at the **same prompt
 * version** with an **older orthography guide version**. It is reused, and
 * every place it is visible says so. The corrected text in such an entry was
 * produced by the same prompt against slightly different spelling rules; that
 * is a real difference and it is not hidden, but re-transcribing to erase it
 * costs money and, because the correction call is not reproducible, changes
 * the corrected words and invalidates the hand-made reference alignments.
 *
 * `none` — nothing usable. A run would call the API and bill.
 *
 * **The compatible rule is deliberately narrow: a guide-version difference at
 * an identical prompt version, and nothing else.** A different prompt version
 * is a different question asked of the model, and an answer to a different
 * question is not a cheaper version of the right answer.
 */
export type EntryProvenance = 'exact' | 'compatible' | 'none';

export interface ResolvedEntry {
  provenance: EntryProvenance;
  /** The entry directory name, or null when nothing was usable. */
  id: string | null;
  dir: string | null;
  promptVersion: number | null;
  /**
   * The guide version the chosen entry was written against, recovered by
   * reproducing its fingerprint rather than assumed. Null when unrecoverable
   * or when nothing was chosen.
   */
  entryGuideVersion: string | null;
  /** What the current configuration computes, whether or not it is on disk. */
  wantedFingerprint: string;
  wantedGuideVersion: string;
  wantedPromptVersion: number;
  /** One sentence, for printing and for stamping into an artifact. */
  note: string;
}

/**
 * Every version `docs/ORTHOGRAPHY_GUIDE.md` has carried, oldest first.
 *
 * It is here rather than derived because the guide's own status line is prose,
 * and a resolver that silently failed to parse it would report `none` and send
 * a caller to the API. `orthography-versions.test.ts` fails when the guide
 * names a version this list does not.
 */
export const GUIDE_VERSION_HISTORY = [
  '1.0.0',
  '1.0.1',
  '1.0.2',
  '1.0.3',
  '1.0.4',
  '1.0.5',
  '1.0.6',
  '1.0.7',
  '1.0.8',
] as const;

export function compareGuideVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10));
  const pb = b.split('.').map((n) => Number.parseInt(n, 10));
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export interface ResolveOptions {
  entries: readonly CachedEntryDescriptor[];
  /** The fingerprint the current configuration computes. */
  wantedFingerprint: string;
  wantedGuideVersion: string;
  wantedPromptVersion?: number;
  /**
   * Reproduces a fingerprint for a hypothetical configuration, so an entry's
   * guide version can be recovered from its own directory name instead of
   * being guessed. Supplied by the caller because the inputs live in the
   * transcription stage.
   */
  fingerprintFor: (promptVersion: number, guideVersion: string) => string;
  /** Restricts the recovery search; defaults to the guide's own history. */
  guideVersions?: readonly string[];
}

function bare(id: string): string {
  const dash = id.lastIndexOf('-');
  return dash === -1 ? id : id.slice(dash + 1);
}

/**
 * Recovers the guide version an entry was written against by reproducing its
 * fingerprint. Returns null when no candidate version reproduces it, which
 * means the entry differs in something other than the guide and is therefore
 * not compatible.
 */
export function recoverGuideVersion(
  entry: CachedEntryDescriptor,
  fingerprintFor: (promptVersion: number, guideVersion: string) => string,
  guideVersions: readonly string[] = GUIDE_VERSION_HISTORY,
): string | null {
  if (entry.promptVersion === null) return null;
  const fingerprint = bare(entry.id);
  for (const guideVersion of guideVersions) {
    if (fingerprintFor(entry.promptVersion, guideVersion) === fingerprint) return guideVersion;
  }
  return null;
}

export function resolveCacheEntry(options: ResolveOptions): ResolvedEntry {
  const {
    entries,
    wantedFingerprint,
    wantedGuideVersion,
    wantedPromptVersion = ACTIVE_PROMPT_VERSION,
    fingerprintFor,
    guideVersions = GUIDE_VERSION_HISTORY,
  } = options;

  const base = {
    wantedFingerprint,
    wantedGuideVersion,
    wantedPromptVersion,
  };

  const exact = entries.find((e) => bare(e.id) === wantedFingerprint);
  if (exact !== undefined) {
    return {
      ...base,
      provenance: 'exact',
      id: exact.id,
      dir: exact.dir,
      promptVersion: exact.promptVersion,
      entryGuideVersion: wantedGuideVersion,
      note: `exact cache hit ${exact.id} (prompt v${exact.promptVersion ?? '?'}, guide v${wantedGuideVersion})`,
    };
  }

  // Same prompt version, older guide. Newest such entry wins: it is the one
  // closest to the rules in force.
  const candidates = entries
    .filter((e) => e.promptVersion === wantedPromptVersion)
    .map((e) => ({ entry: e, guide: recoverGuideVersion(e, fingerprintFor, guideVersions) }))
    .filter(
      (c): c is { entry: CachedEntryDescriptor; guide: string } =>
        c.guide !== null && compareGuideVersions(c.guide, wantedGuideVersion) < 0,
    )
    .sort((a, b) => compareGuideVersions(b.guide, a.guide));

  const best = candidates[0];
  if (best !== undefined) {
    return {
      ...base,
      provenance: 'compatible',
      id: best.entry.id,
      dir: best.entry.dir,
      promptVersion: best.entry.promptVersion,
      entryGuideVersion: best.guide,
      note:
        `reusing ${best.entry.id}, a transcription made against orthography guide ` +
        `v${best.guide} while the guide is now v${wantedGuideVersion}. Same prompt ` +
        `version (v${wantedPromptVersion}), so it will not re-transcribe and will not bill.`,
    };
  }

  return {
    ...base,
    provenance: 'none',
    id: null,
    dir: null,
    promptVersion: null,
    entryGuideVersion: null,
    note:
      `no cache entry for fingerprint ${wantedFingerprint} (prompt v${wantedPromptVersion}, ` +
      `guide v${wantedGuideVersion}) and none compatible; a run would transcribe and bill`,
  };
}
