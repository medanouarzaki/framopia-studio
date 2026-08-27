/**
 * The panel's own width, watched.
 *
 * Session 9 did this with a CSS container query, which is the right tool and
 * the wrong engine: CEP 12 runs **Chromium 99**, and `container-type` shipped
 * in Chrome 105. The property is not merely unhonoured, it is unrecognised —
 * `getComputedStyle(el).containerType` is `undefined` in the running panel — so
 * the `@container` block was dead text and the panel rendered one column at
 * 1572 px.
 *
 * `ResizeObserver` shipped in Chrome 64 and is what CEP has. It also fires once
 * on observe, which matters: reading the width during the first render gives
 * the size before layout, and a breakpoint evaluated once at mount is the other
 * common way this never fires.
 */

/**
 * 830 px of the panel's own width, unchanged from session 9 and measured there:
 * a column must never be narrower than the single column already is when the
 * panel is docked at the manifest's 420 px, where the value side of a fact row
 * is 242 px. Two columns reach 241 px at 820 and 246 px at 830. Only the
 * mechanism was wrong.
 */
export const PANEL_TWO_COLUMN_PX = 830;

export function isWide(width: number): boolean {
  return width >= PANEL_TWO_COLUMN_PX;
}

/**
 * Calls back with the element's width now and on every change.
 *
 * Falls back to a window resize listener where `ResizeObserver` is absent. That
 * is a weaker signal — a docked panel can be resized without the window
 * changing — but it is better than a layout frozen at whatever the first paint
 * happened to be, and CEP 12 has the observer in any case.
 */
export function observeWidth(
  element: HTMLElement,
  onWidth: (width: number) => void,
): () => void {
  const measure = (): void => onWidth(element.getBoundingClientRect().width);

  const Observer = (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
  if (Observer !== undefined) {
    const observer = new Observer((entries) => {
      const entry = entries[0];
      // `contentRect` is the post-layout size; the bounding rect is the
      // fallback for an entry without one.
      onWidth(entry?.contentRect.width ?? element.getBoundingClientRect().width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }

  measure();
  const onResize = (): void => measure();
  globalThis.addEventListener?.('resize', onResize);
  return () => globalThis.removeEventListener?.('resize', onResize);
}
