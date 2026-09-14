import { useEffect, useRef, useState } from 'react';

/**
 * **How wide the panel is — measured, never asked of the window.**
 *
 * Block 13 session 106. `docs/ARCHITECTURE.md` records the reason in one line:
 * *"A docked CEP panel's window is the size of the screen while its panel is a
 * column wide, so a media query lays out for the wrong thing. Any future
 * responsive rule has to measure the panel, not the viewport."*
 *
 * Session 105 laid the two pickers out side by side behind a width query on the
 * window. Docked at 420 px on a 1920 px screen that query is **true**, so it would
 * have paired two 460 px fields inside a 420 px column — on his machine, and on no
 * test, because a test viewport and a test panel are the same thing.
 *
 * A container query is the right tool and CEP cannot run one: `container-type`
 * shipped in Chrome 105 and CEP 12 is Chromium 99, which is why it sits on the
 * capability denylist beside `:has()`. So the panel measures itself.
 * `ResizeObserver` is Chrome 64 and safe here.
 *
 * Returns the width in pixels, or `null` until the first measurement — one frame,
 * treated as narrow, so the panel never flashes a wide layout it is about to lose.
 */
export function useRoom<T extends HTMLElement>(): {
  ref: React.RefObject<T>;
  width: number | null;
} {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    /*
     * A host without ResizeObserver gets one measurement and no updates, which is
     * a narrow panel that stays narrow — the safe half of the choice.
     */
    if (typeof ResizeObserver === 'undefined') {
      setWidth(el.getBoundingClientRect().width);
      return;
    }
    const watch = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(entry.contentRect.width);
    });
    watch.observe(el);
    return () => {
      watch.disconnect();
    };
  }, []);

  return { ref, width };
}

/**
 * **820 px is where two things fit side by side**, and it is one number in one
 * place. Below it the panel is the single column it has always been.
 */
export const ROOM_FOR_TWO = 820;
