import type { ClientSnapshot } from '@framopia/core';

/**
 * The font names a build will write to a text layer, for this client.
 *
 * **After Effects does not refuse a name it cannot resolve** — it accepts an
 * invented one, reads it back unchanged, and renders a substitute. Measured on
 * 26.0x67 in Block 9 session 5. So a face missing from the machine produces a
 * comp that looks built and is set in the wrong type, with nothing anywhere
 * saying so, and the only defence is to check before anything is placed.
 *
 * **Empty until a build names its faces.** Nothing sets `TextDocument.font`
 * yet: type comes from the template comps, so today a build needs no face of
 * its own and this returns nothing. A client whose PostScript names have not
 * been measured on a host also returns nothing — an unresolved name is not a
 * missing one, and refusing on it would refuse every client but K2.
 *
 * The family-and-style strings are deliberately not returned. They cannot be
 * written to a text layer at all: After Effects rejects any font name with a
 * space in it.
 */
export function requiredFonts(snapshot: ClientSnapshot | null): string[] {
  if (snapshot === null) return [];
  if (snapshot.fonts.status !== 'set') return [];
  const names = snapshot.fonts.postScriptNames;
  if (names === undefined) return [];
  const wanted = [names.latin, names.arabic, names.emphasis].filter(
    (n): n is string => typeof n === 'string' && n.length > 0,
  );
  return [...new Set(wanted)].sort();
}
