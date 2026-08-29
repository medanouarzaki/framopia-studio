import {
  ARABIC_FONT,
  ARABIC_SIZE_RATIO,
  EMPHASIS_SIZE_RATIO,
  LATIN_FONT,
} from './typography.js';

/**
 * Which fonts a build will actually use, and where they came from.
 *
 * PROJECT_SPEC §5 makes subtitle position and base style **global, not
 * per-mode**, and the four template comps were hand-built with Inter Semi-Bold
 * and Almarai Bold. So a mode whose `fonts.status` is still `tbd` does not stop
 * a build — Block 7 built `vitasilk` end to end with exactly that mode.
 *
 * **This was true by accident until Block 8 session 9.** `requireFonts` throws
 * on a `tbd` mode, but nothing outside `core` has ever called it: the builder
 * never asked, so it never found out, and the fallback was incidental rather
 * than decided. A rule nobody states is a rule nobody can rely on.
 *
 * Block 9 session 2 gave `k2-syndicalia` its real faces, so that client now
 * takes the `mode` branch. Every other client, and every client yet to be
 * made, still takes the global pair — the fallback is not retired, it is just
 * no longer what K2 gets.
 */
export interface BuildFonts {
  latin: string;
  arabic: string;
  /**
   * The face an emphasized word is set in. A client with no emphasis face of
   * its own gets the ordinary Latin face, which is what every build drew before
   * the field existed.
   */
  emphasis: string;
  /** The Arabic face is set at this multiple of the Latin size. */
  arabicSizeRatio: number;
  /** The emphasis face is set at this multiple of the Latin size. */
  emphasisSizeRatio: number;
  source: 'mode' | 'global';
  /** Whether the emphasis face is the client's own or the ordinary Latin one. */
  emphasisSource: 'mode' | 'latin';
  /** Null when the mode supplies its own; otherwise what the user is told. */
  warning: string | null;
}

export interface ModeFontsLike {
  name: string;
  fonts: { status: string; latin?: string; arabic?: string; emphasis?: string };
}

export function buildFonts(mode: ModeFontsLike): BuildFonts {
  if (mode.fonts.status === 'set' && mode.fonts.latin !== undefined && mode.fonts.arabic !== undefined) {
    return {
      latin: mode.fonts.latin,
      arabic: mode.fonts.arabic,
      emphasis: mode.fonts.emphasis ?? mode.fonts.latin,
      arabicSizeRatio: ARABIC_SIZE_RATIO,
      emphasisSizeRatio: EMPHASIS_SIZE_RATIO,
      source: 'mode',
      emphasisSource: mode.fonts.emphasis === undefined ? 'latin' : 'mode',
      warning: null,
    };
  }
  return {
    latin: LATIN_FONT,
    arabic: ARABIC_FONT,
    emphasis: LATIN_FONT,
    arabicSizeRatio: ARABIC_SIZE_RATIO,
    emphasisSizeRatio: EMPHASIS_SIZE_RATIO,
    source: 'global',
    emphasisSource: 'latin',
    warning:
      `${mode.name} has no fonts of its own yet, so the build will use the global subtitle ` +
      `pair: ${LATIN_FONT} for Latin and ${ARABIC_FONT} for Arabic at ${ARABIC_SIZE_RATIO}x. ` +
      'PROJECT_SPEC §5 reserves the client’s own fonts for Block 9; everything before the ' +
      'build runs normally.',
  };
}
