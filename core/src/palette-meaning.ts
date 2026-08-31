/**
 * The four roles a client's palette carries.
 *
 * Declared here, in a module with **no imports**, rather than in `mode.ts`:
 * the panel reads these captions and `mode.ts` reaches `node:crypto` and
 * `node:fs`, which esbuild cannot resolve for a browser target. `mode.ts`
 * re-exports both, so nothing that already imported them changed.
 */
export const PALETTE_ROLES = ['background', 'primary', 'accent', 'light'] as const;
export type PaletteRole = (typeof PALETTE_ROLES)[number];

/**
 * What each of a client's four colours actually does, in the words a motion
 * designer would use about his own videos.
 *
 * **The old captions described the picture frame and nothing else**, and two of
 * the four were wrong. They read: *behind a cut-out picture* / *the deeper of
 * the two frame colours* / *the frame around a picture* / *the lighter of the
 * two frame colours* — while in every comp this system has built, `light` is
 * the colour of **ordinary subtitle words** and `accent` is the colour of
 * **emphasised keywords**, which are the two most visible uses of any colour in
 * the product and appeared in no caption.
 *
 * Measured in Block 10 session 18, from the code and then from four real builds:
 *
 * - **`light`** — 254 ordinary subtitle words across the corpus, and the frame
 *   drawn round all five of `vitasilk`'s pictures.
 * - **`accent`** — 8 emphasised keyword words. It can **never** be a picture
 *   frame: `cardFrameColour` takes whichever role separates best from the
 *   picture's own edge, and over a sweep of every edge luminance only `light`
 *   and `background` ever win. A mid-tone loses to both extremes.
 * - **`background`** — the ground baked behind a cut-out, read off
 *   `img002-c1.cutout.on-fill.png` as `#1A0000` at all four corners, and the
 *   frame on a picture bright enough for the dark one to win.
 * - **`primary`** — **nothing in the built comp comes from it.** The 262 shadow
 *   layers all read `#820000`, but that is the four template comps' own colour,
 *   baked in and never set by the build (`reel-plan.ts`: the shadow is "never
 *   given a colour — the shadow's own is the design"). It equals K2's `primary`
 *   by coincidence of the brand, and a different client's `primary` would not
 *   move it. What `primary` really does is reach the image model, which is a job
 *   the user can see the result of.
 *
 * All four are named in `imageStyle.stylePrompt`, so all four shape the pictures
 * that get generated. Where a colour does more than one job the line says so
 * rather than picking one and hiding the other.
 *
 * **This is what the screen says, not what the system does.** No role was
 * renamed and no value changed.
 */
export const PALETTE_MEANING: Record<PaletteRole, string> = {
  light: 'your ordinary subtitle words, and usually the frame round a picture',
  accent: 'the words you emphasise',
  background: 'behind a cut-out picture, and the ground the generated pictures are lit against',
  primary: 'depth in the generated pictures — the shadow behind your words comes from the template, not from here',
};

/**
 * The order the four are shown in.
 *
 * Not the file's order: the two subtitle colours are what he sees on every card
 * of every video, so they come first, and the two that only touch pictures
 * follow.
 */
export const PALETTE_DISPLAY_ORDER: readonly PaletteRole[] = [
  'light',
  'accent',
  'background',
  'primary',
];

export function paletteRolesInDisplayOrder(): PaletteRole[] {
  const ordered = PALETTE_DISPLAY_ORDER.filter((role) => PALETTE_ROLES.includes(role));
  const rest = PALETTE_ROLES.filter((role) => !PALETTE_DISPLAY_ORDER.includes(role));
  return [...ordered, ...rest];
}
