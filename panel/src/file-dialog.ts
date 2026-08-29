import { VIDEO_EXTENSIONS_WITHOUT_DOT } from './video-extensions.js';

/**
 * A real file dialog, if this host has one.
 *
 * A browser `<input type="file">` is no use here: it yields a sandboxed `File`
 * whose path the page cannot see, and every stage of this pipeline needs an
 * absolute path. CEP has its own dialog — `window.cep.fs.showOpenDialogEx` —
 * which returns one.
 *
 * **Whether it is here is a claim about the host, and this project has been
 * wrong about the host five times.** So nothing assumes: the panel looks, says
 * what it found in the readiness details, and shows Browse **only when the call
 * is really there**. The path field stays either way, because it works in any
 * engine and because a button that silently does nothing is worse than no
 * button.
 *
 * `window.cep` is injected by CEP itself and is not `CSInterface`, which this
 * extension has never loaded — that distinction is what made this worth
 * probing rather than assuming.
 */
interface CepDialogResult {
  err?: number;
  data?: unknown;
}

interface CepFs {
  showOpenDialogEx?: (
    allowMultiple: boolean,
    chooseDirectory: boolean,
    title: string,
    initialPath: string,
    fileTypes?: string[],
  ) => CepDialogResult;
  showOpenDialog?: (
    allowMultiple: boolean,
    chooseDirectory: boolean,
    title: string,
    initialPath: string,
    fileTypes?: string[],
  ) => CepDialogResult;
}

function cepFs(): CepFs | null {
  try {
    const cep = (globalThis as { cep?: { fs?: CepFs } }).cep;
    return cep?.fs ?? null;
  } catch {
    return null;
  }
}

export interface DialogSupport {
  available: boolean;
  /** Which call is there, for the readiness details and for a report back. */
  api: 'showOpenDialogEx' | 'showOpenDialog' | null;
  /** One line, written for him. */
  detail: string;
}

export function fileDialogSupport(): DialogSupport {
  const fs = cepFs();
  if (fs === null) {
    return {
      available: false,
      api: null,
      detail: 'no file dialog in this host — type or paste a path instead',
    };
  }
  if (typeof fs.showOpenDialogEx === 'function') {
    return { available: true, api: 'showOpenDialogEx', detail: 'a file dialog is available' };
  }
  if (typeof fs.showOpenDialog === 'function') {
    return { available: true, api: 'showOpenDialog', detail: 'a file dialog is available' };
  }
  return {
    available: false,
    api: null,
    detail: 'this host has cep.fs but no open dialog — type or paste a path instead',
  };
}

/**
 * Opens the dialog and returns one absolute path, or null if he cancelled.
 *
 * CEP answers `{ err, data }` where `data` is a list even for one file, and a
 * cancel is a non-zero `err` rather than an exception — so both are handled as
 * "he chose nothing", which is not an error to report.
 */
export function pickVideoFile(startIn: string): string | null {
  const fs = cepFs();
  if (fs === null) return null;
  const open = fs.showOpenDialogEx ?? fs.showOpenDialog;
  if (typeof open !== 'function') return null;
  let result: CepDialogResult;
  try {
    result = open(false, false, 'Choose a video', startIn, [...VIDEO_EXTENSIONS_WITHOUT_DOT]);
  } catch {
    return null;
  }
  if (result.err !== undefined && result.err !== 0) return null;
  const data = result.data;
  if (!Array.isArray(data) || data.length === 0) return null;
  const first = data[0];
  return typeof first === 'string' && first !== '' ? first : null;
}
