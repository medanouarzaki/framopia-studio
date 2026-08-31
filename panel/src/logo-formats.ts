/**
 * What a client's logo may be.
 *
 * **Ruling, 2026-08-31**: the intended logo is a PNG with transparency, and the
 * field also takes the other still-image formats After Effects imports.
 *
 * **No authority for that set existed anywhere in this repository** — the video
 * list is mirrored from `service/src/clients/videos.ts` and pinned by a test,
 * and nothing equivalent had ever been written down for stills. So this list is
 * a decision rather than a reading, recorded in `docs/PROJECT_SPEC.md` §5 with
 * the date. It is deliberately conservative: formats a logo is plausibly
 * delivered in, not everything After Effects can open.
 */
export const LOGO_EXTENSIONS_WITHOUT_DOT = [
  'png',
  'psd',
  'ai',
  'eps',
  'tif',
  'tiff',
  'tga',
  'jpg',
  'jpeg',
  'gif',
  'bmp',
] as const;

/**
 * The subset the panel itself can draw.
 *
 * **Today the only thing that reads a client's `logoPath` is the panel**, which
 * puts it in an `<img>` on the client card — no build places it. So a `.psd` is
 * a legitimate choice under the ruling and still cannot be shown here, and the
 * screen says which of the two it is rather than leaving a broken image.
 */
export const LOGO_EXTENSIONS_THE_PANEL_CAN_SHOW = ['png', 'jpg', 'jpeg', 'gif', 'bmp'] as const;

function extensionOf(pathname: string): string {
  const base = pathname.split('/').pop() ?? '';
  const dot = base.lastIndexOf('.');
  return dot === -1 ? '' : base.slice(dot + 1).toLowerCase();
}

export type LogoVerdict =
  | { kind: 'empty' }
  | { kind: 'ok' }
  | { kind: 'not-previewable'; extension: string }
  | { kind: 'unusable'; extension: string };

/**
 * Judged the moment he picks it, not at build time three steps later.
 */
export function judgeLogo(pathname: string): LogoVerdict {
  if (pathname.trim() === '') return { kind: 'empty' };
  const extension = extensionOf(pathname);
  if (!(LOGO_EXTENSIONS_WITHOUT_DOT as readonly string[]).includes(extension)) {
    return { kind: 'unusable', extension };
  }
  if (!(LOGO_EXTENSIONS_THE_PANEL_CAN_SHOW as readonly string[]).includes(extension)) {
    return { kind: 'not-previewable', extension };
  }
  return { kind: 'ok' };
}

export function logoVerdictSentence(verdict: LogoVerdict): string | null {
  switch (verdict.kind) {
    case 'empty':
    case 'ok':
      return null;
    case 'not-previewable':
      return `A .${verdict.extension} works, but this panel cannot show you a preview of one.`;
    case 'unusable':
      return `A .${verdict.extension} cannot be used as a logo. ${LOGO_EXTENSIONS_WITHOUT_DOT.join(', ')} can.`;
  }
}
