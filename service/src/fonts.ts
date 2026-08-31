import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { REPO_ROOT } from '@framopia/core';
import { AeDriveError, runFontList } from './build/drive.js';

/**
 * The faces the client setup screen offers.
 *
 * **A list that cannot be built is said out loud, never shown as empty.** An
 * empty chooser and a chooser that could not be filled look identical on screen
 * and mean opposite things — the first says this machine has no fonts, which is
 * never true. So the reply carries `available` and, when it is false, the reason
 * in the words the panel prints, and the panel falls back to a text field.
 */
/**
 * A face the panel can actually draw with, or the reason it cannot.
 *
 * **The panel is a browser: it draws a face only if it can load the file.** The
 * name After Effects uses is not enough, and matching on the PostScript name
 * macOS publishes resolves 900 of 1188 here while missing two of the three faces
 * this studio uses — both are variable fonts, whose instances After Effects
 * names its own way. `tools/font-resolve/resolve.py` asks CoreText instead.
 *
 * `axes` matters because a variable font loaded by CSS renders its **default**
 * instance: the file behind `Inter-SemiBold` is `Inter-VariableFont`, whose
 * default is Regular, so drawing it without `wght: 600` would show a face nobody
 * chose. That is the defect this whole thing exists to remove.
 */
export interface ResolvedFace {
  /** Absolute, or null when nothing can draw it here. */
  file: string | null;
  /** Variation axes to apply, e.g. `{ wght: 600 }`. Empty for a static face. */
  axes: Record<string, number>;
  /** Why it cannot be drawn. Null when it can. */
  why: string | null;
}

export interface FontListView {
  available: boolean;
  /** After Effects' own names, which are the only ones a build can use. */
  names: string[];
  /** How many families the host reported, beside how many faces they carry. */
  families: number | null;
  /** Null when the list was built. */
  trouble: string | null;
  /**
   * Name to the file that can draw it. A name absent from here, or present with
   * a null `file`, cannot be previewed — and the panel says so rather than
   * drawing something else.
   */
  faces: Record<string, ResolvedFace>;
}

const RESOLVER = path.join(REPO_ROOT, 'tools', 'font-resolve', 'resolve.py');

/**
 * Every name resolved in one pass — 1188 of them in about 0.2 s, so there is
 * nothing to gain by resolving lazily and a great deal to lose in a panel that
 * would then have to ask again for every keystroke.
 *
 * A resolver that cannot run is not an error: the list is still useful without
 * previews, and every face then reports why it cannot be drawn.
 */
function resolveFaces(names: string[]): Record<string, ResolvedFace> {
  let raw: string;
  try {
    raw = execFileSync('python3', [RESOLVER], {
      input: JSON.stringify({ names }),
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (error) {
    const why = `the font resolver did not run: ${(error as Error).message}`;
    return Object.fromEntries(names.map((n) => [n, { file: null, axes: {}, why }]));
  }
  let parsed: { fonts?: Record<string, { path?: string | null; axes?: Record<string, number>; why?: string | null }> };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    const why = 'the font resolver answered with something that is not JSON';
    return Object.fromEntries(names.map((n) => [n, { file: null, axes: {}, why }]));
  }
  const fonts = parsed.fonts ?? {};
  return Object.fromEntries(
    names.map((n) => {
      const hit = fonts[n];
      if (hit === undefined) {
        return [n, { file: null, axes: {}, why: 'the resolver said nothing about this font' }];
      }
      return [
        n,
        {
          file: hit.path ?? null,
          axes: hit.axes ?? {},
          why: hit.path == null ? (hit.why ?? 'this font cannot be drawn here') : null,
        },
      ];
    }),
  );
}

export function fontListView(): FontListView {
  let result;
  try {
    result = runFontList();
  } catch (error) {
    const why =
      error instanceof AeDriveError
        ? error.message
        : `After Effects did not answer: ${(error as Error).message}`;
    return { available: false, names: [], families: null, trouble: why, faces: {} };
  }
  if (!result.ok) {
    return {
      available: false,
      names: [],
      families: null,
      trouble: result.message ?? 'After Effects refused to list its fonts',
      faces: {},
    };
  }
  const raw = result as unknown as { names?: unknown; families?: unknown };
  const names = Array.isArray(raw.names)
    ? [...new Set(raw.names.filter((n): n is string => typeof n === 'string' && n !== ''))].sort(
        (a, b) => a.localeCompare(b),
      )
    : [];
  if (names.length === 0) {
    return {
      available: false,
      names: [],
      families: null,
      trouble: 'After Effects answered with no fonts at all, which cannot be right',
      faces: {},
    };
  }
  return {
    available: true,
    names,
    families: typeof raw.families === 'number' && raw.families >= 0 ? raw.families : null,
    trouble: null,
    faces: resolveFaces(names),
  };
}
