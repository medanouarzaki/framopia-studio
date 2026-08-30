import type { ClientMode, PaletteRole } from './mode.js';

/**
 * Which colour each kind of subtitle word is drawn in, resolved against a
 * client's palette.
 *
 * The default is what every build has drawn since the templates were made:
 * ordinary words in the palette's light, emphasized words in its accent. K2's
 * brand document states the same thing in its own words — crème for body,
 * Or Signature for the key figure of a sentence — so recording the roles is
 * making an existing rule sayable rather than changing anything.
 *
 * **Nothing reads this at build time yet.** A subtitle's colour lives in the
 * template comp's own text layer, and `framopiaSetText` deliberately sets only
 * the string. Making the build mode-driven is a change the user rules on by
 * looking at a build, not one to slip in beside a data addition.
 */
export const DEFAULT_TEXT_COLOUR_ROLES: { ordinary: PaletteRole; emphasis: PaletteRole } = {
  ordinary: 'light',
  emphasis: 'accent',
};

export interface ResolvedTextColour {
  role: PaletteRole;
  hex: string;
  /** Whether the client named the role or took the standard one. */
  source: 'client' | 'standard';
}

export interface ResolvedTextColours {
  ordinary: ResolvedTextColour;
  emphasis: ResolvedTextColour;
  /**
   * Null when the client names none, which means the template's own shadow
   * colour stands. There is deliberately no default: see `ModeTextColours`.
   */
  shadow: ResolvedTextColour | null;
}

export function resolveTextColours(
  mode: Pick<ClientMode, 'palette' | 'textColours'>,
): ResolvedTextColours {
  const of = (key: 'ordinary' | 'emphasis'): ResolvedTextColour => {
    const named = mode.textColours?.[key];
    const role = named ?? DEFAULT_TEXT_COLOUR_ROLES[key];
    return { role, hex: mode.palette[role], source: named === undefined ? 'standard' : 'client' };
  };
  const shadowRole = mode.textColours?.shadow;
  return {
    ordinary: of('ordinary'),
    emphasis: of('emphasis'),
    shadow:
      shadowRole === undefined
        ? null
        : { role: shadowRole, hex: mode.palette[shadowRole], source: 'client' },
  };
}
