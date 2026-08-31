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
 * - **`primary`** — **the shadow copy drawn behind every word**, 262 layers
 *   across the corpus. Until 2026-08-31 that colour was baked into the four
 *   template comps and the build never set it, so it matched K2 only by
 *   coincidence of the brand and a different client got K2's red with nothing
 *   saying so. The user ruled that the shadow takes the client's deeper colour;
 *   `textStyleFor` resolves it and the build sets it on the duplicated
 *   instance's shadow layer. It also reaches the image model.
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
  primary: 'the shadow behind every word, and depth in the generated pictures',
};

/**
 * The order the four are shown in.
 *
 * Not the file's order: the colours he sees on every card of every video come
 * first — the word, the emphasised word, and the shadow behind both — and the
 * one that only touches pictures follows.
 *
 * `primary` moved up on 2026-08-31, when the shadow started taking the client's
 * deeper colour instead of the template's. It was last while it did nothing a
 * viewer could see.
 */
export const PALETTE_DISPLAY_ORDER: readonly PaletteRole[] = [
  'light',
  'accent',
  'primary',
  'background',
];

export function paletteRolesInDisplayOrder(): PaletteRole[] {
  const ordered = PALETTE_DISPLAY_ORDER.filter((role) => PALETTE_ROLES.includes(role));
  const rest = PALETTE_ROLES.filter((role) => !PALETTE_DISPLAY_ORDER.includes(role));
  return [...ordered, ...rest];
}
