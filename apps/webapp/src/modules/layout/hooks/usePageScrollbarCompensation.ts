import { useLayoutEffect, useRef } from 'react';

/** CSS custom property the shell surface reads as its `padding-right`. */
export const PAGE_SCROLLBAR_PAD_VAR = '--page-scrollbar-pad';

/**
 * Keeps the page content in the same horizontal position whether or not the
 * document currently has a scrollbar.
 *
 * Routes that fit the viewport (Convert at desktop heights) have no page
 * scrollbar; routes that overflow do, and with classic (space-taking)
 * scrollbars the bar narrows the viewport by its width, so the centred
 * content shifts sideways on every navigation between the two kinds. The
 * usual fix, `scrollbar-gutter: stable` on the root, reserves the space but
 * paints it in the root's background colour — a flat strip that neither shows
 * the page's background image nor takes the styled track colour, and in dark
 * mode is plain white (the root has no colour there). Pinning the bar open
 * with `overflow-y: scroll` shows the styled track, but on pages that don't
 * scroll a track with no thumb is just a strip of a slightly different blue.
 *
 * So instead: when the bar is absent, the shell surface pads its right edge
 * by exactly the bar's width, and the viewport-fixed background image shows
 * through the pad; when the bar is present the pad is 0 and the bar sits in
 * the same columns. Content lands in the same place either way.
 *
 * Mechanics:
 * - The bar's width is measured from a probe box on every update, not
 *   assumed and not cached: with overlay scrollbars (macOS trackpad default,
 *   all phones) it is 0 and the pad is 0, and macOS flips between overlay and
 *   classic bars live when a mouse is plugged in or the setting changes.
 * - Presence is `innerWidth - documentElement.clientWidth > 0`, re-read from
 *   a ResizeObserver on html + body (the document's height changes when a
 *   route renders or its content loads) and on window resize. The observer
 *   callback runs after layout and before paint, so a route lands already
 *   compensated — no flash. Writing the pad from inside that callback can
 *   re-layout body, which Chrome may report as a "ResizeObserver loop"
 *   console error; deferring the write to the next frame would avoid it at
 *   the cost of one frame of shifted content on every navigation, so the
 *   synchronous write is the deliberate choice.
 * - Scroll locks (Radix dialogs via react-remove-scroll) hide the bar and
 *   compensate on `body` themselves — as a margin-right in its default gap
 *   mode (measured: 11px on the wallet modal), as a padding in the other. The
 *   space body already gives up on the right, margin or padding, is subtracted
 *   so the two compensations never stack.
 * - Padding can itself change whether the page overflows (a narrower box can
 *   wrap a line and grow taller), which would flip the state back and forth
 *   forever. A genuine loop reverses direction on consecutive frames; a burst
 *   of legitimate changes (route render, then content loading) moves one way.
 *   So only repeated quick reversals count, and when they do the pad is
 *   pinned to 0 — the uncompensated layout, never a pad on top of a present
 *   bar. The pin clears on navigation, on a scroll lock starting or ending,
 *   and on resize, so a false pin can never outlive the state that caused it.
 *
 * @param resetKey Changes on navigation (the route path); clears any pin.
 */
export function usePageScrollbarCompensation(resetKey?: unknown): void {
  const unpinRef = useRef<() => void>(() => {});

  useLayoutEffect(() => {
    unpinRef.current();
  }, [resetKey]);

  useLayoutEffect(() => {
    if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') return;

    const root = document.documentElement;
    let applied: number | null = null;
    let before: number | null = null; // the value `applied` replaced
    let reversals = 0;
    let lastChange = 0;
    let pinned = false;
    let lastLocked: boolean | null = null;

    const write = (px: number) => {
      before = applied;
      applied = px;
      root.style.setProperty(PAGE_SCROLLBAR_PAD_VAR, `${px}px`);
    };

    const update = () => {
      const locked = document.body.hasAttribute('data-scroll-locked');
      if (locked !== lastLocked) {
        lastLocked = locked;
        pinned = false;
        reversals = 0;
      }
      if (pinned) return;

      const barWidth = measureScrollbarWidth();
      const hasBar = window.innerWidth - root.clientWidth > 0;
      const body = document.body;
      const bodyGap =
        root.clientWidth -
        body.getBoundingClientRect().right +
        (parseFloat(getComputedStyle(body).paddingRight) || 0);
      const next = hasBar || barWidth === 0 ? 0 : Math.max(0, barWidth - Math.round(bodyGap));
      if (next === applied) return;

      const now = performance.now();
      reversals = next === before && now - lastChange < REVERSAL_WINDOW_MS ? reversals + 1 : 0;
      lastChange = now;
      if (reversals >= REVERSALS_TO_PIN) {
        pinned = true;
        write(0);
        return;
      }
      write(next);
    };

    const unpin = () => {
      pinned = false;
      reversals = 0;
      update();
    };
    unpinRef.current = unpin;

    const observer = new ResizeObserver(update);
    observer.observe(root);
    observer.observe(document.body);
    window.addEventListener('resize', unpin);
    update();

    return () => {
      unpinRef.current = () => {};
      observer.disconnect();
      window.removeEventListener('resize', unpin);
      root.style.removeProperty(PAGE_SCROLLBAR_PAD_VAR);
    };
  }, []);
}

/** A change that undoes the previous one within this window is a reversal. */
const REVERSAL_WINDOW_MS = 500;
/** Consecutive reversals before the state is treated as a feedback loop. */
const REVERSALS_TO_PIN = 3;

/**
 * Width of a classic scrollbar in this browser, 0 when scrollbars are overlay.
 * The probe inherits the root's `scrollbar-width: thin` recipe via the
 * `:root *` rule, so it measures the same bar the viewport draws. It is
 * absolutely positioned, so adding it does not resize body.
 */
function measureScrollbarWidth(): number {
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText =
    'position:absolute;top:-9999px;left:-9999px;width:100px;height:100px;overflow:scroll;visibility:hidden;pointer-events:none;';
  document.body.appendChild(probe);
  const width = probe.offsetWidth - probe.clientWidth;
  probe.remove();
  return width;
}
