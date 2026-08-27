import { ARABIC_FONT, ARABIC_SIZE_RATIO, LATIN_FONT } from './typography.js';

/**
 * Which fonts a build will actually use, and where they came from.
 *
 * PROJECT_SPEC §5 makes subtitle position and base style **global, not
 * per-mode**, and the four template comps were hand-built with Inter Semi-Bold
 * and Almarai Bold. So a mode whose `fonts.status` is still `tbd` does not stop
 * a build — Block 7 built `vitasilk` end to end with exactly that mode.
 *
 * **This was true by accident until now.** `requireFonts` throws on a `tbd`
 * mode, but nothing outside `core` has ever called it: the builder never asked,
 * so it never found out, and the fallback was incidental rather than decided.
 * A rule nobody states is a rule nobody can rely on.
 *
 * The per-mode fonts are for the client's own type identity, which
 * PROJECT_SPEC §5 reserves for Block 9. Until they arrive the global pair is
 * what renders, and the panel says so.
 */
export interface BuildFonts {
  latin: string;
  arabic: string;
  /** The Arabic face is set at this multiple of the Latin size. */
  arabicSizeRatio: number;
  source: 'mode' | 'global';
  /** Null when the mode supplies its own; otherwise what the user is told. */
  warning: string | null;
}

export interface ModeFontsLike {
  name: string;
  fonts: { status: string; latin?: string; arabic?: string };
}

export function buildFonts(mode: ModeFontsLike): BuildFonts {
  if (mode.fonts.status === 'set' && mode.fonts.latin !== undefined && mode.fonts.arabic !== undefined) {
    return {
      latin: mode.fonts.latin,
      arabic: mode.fonts.arabic,
      arabicSizeRatio: ARABIC_SIZE_RATIO,
      source: 'mode',
      warning: null,
    };
  }
  return {
    latin: LATIN_FONT,
    arabic: ARABIC_FONT,
    arabicSizeRatio: ARABIC_SIZE_RATIO,
    source: 'global',
    warning:
      `${mode.name} has no fonts of its own yet, so the build will use the global subtitle ` +
      `pair: ${LATIN_FONT} for Latin and ${ARABIC_FONT} for Arabic at ${ARABIC_SIZE_RATIO}x. ` +
      'PROJECT_SPEC §5 reserves the client’s own fonts for Block 9; everything before the ' +
      'build runs normally.',
  };
}
