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
 * **The build reads this.** `textStyleFor` resolves these roles and sets
 * `fillColor` on the placeholder of every card, which is where the corpus's 254
 * ordinary words in `light` and 8 emphasised words in `accent` come from —
 * measured from four real builds in Block 10 session 18. This comment said
 * "nothing reads this at build time yet" until then; it had been stale since
 * Block 9 session 6 wired it up.
 *
 * **The shadow is not among them by default.** `TXT_MAIN_SHADOW`'s colour is
 * baked into the template comps and the build never sets it, so a client that
 * names no `shadow` role leaves the template's own — which is the design.
 */
export const DEFAULT_TEXT_COLOUR_ROLES: {
  ordinary: PaletteRole;
  emphasis: PaletteRole;
  shadow: PaletteRole;
} = {
  ordinary: 'light',
  emphasis: 'accent',
  shadow: 'primary',
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
   * **The client's deeper colour, `primary` by default** — user ruling,
   * 2026-08-31, by the person who authored the templates. He chose it over a
   * fifth swatch on the client screen and over leaving the templates' fixed red.
   *
   * It used to be null unless a client named a role, meaning the template's own
   * colour stood. That gave every client K2's red behind their words with
   * nothing saying so: `#820000` is baked into all four text comps and matched
   * K2 only because the template's red happens to be K2's red.
   */
  shadow: ResolvedTextColour;
}

export function resolveTextColours(
  mode: Pick<ClientMode, 'palette' | 'textColours'>,
): ResolvedTextColours {
  const of = (key: 'ordinary' | 'emphasis' | 'shadow'): ResolvedTextColour => {
    const named = mode.textColours?.[key];
    const role = named ?? DEFAULT_TEXT_COLOUR_ROLES[key];
    return { role, hex: mode.palette[role], source: named === undefined ? 'standard' : 'client' };
  };
  return {
    ordinary: of('ordinary'),
    emphasis: of('emphasis'),
    shadow: of('shadow'),
  };
}
