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
export interface FontListView {
  available: boolean;
  /** After Effects' own names, which are the only ones a build can use. */
  names: string[];
  /** How many families the host reported, beside how many faces they carry. */
  families: number | null;
  /** Null when the list was built. */
  trouble: string | null;
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
    return { available: false, names: [], families: null, trouble: why };
  }
  if (!result.ok) {
    return {
      available: false,
      names: [],
      families: null,
      trouble: result.message ?? 'After Effects refused to list its fonts',
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
    };
  }
  return {
    available: true,
    names,
    families: typeof raw.families === 'number' && raw.families >= 0 ? raw.families : null,
    trouble: null,
  };
}
