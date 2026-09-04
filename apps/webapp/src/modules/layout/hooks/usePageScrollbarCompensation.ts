import { useLayoutEffect } from 'react';

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
 * - The bar's width is measured once from a probe box, not assumed: with
 *   overlay scrollbars (macOS trackpad default, all phones) it is 0, in which
 *   case there is nothing to compensate and no observer is installed.
 * - Presence is `innerWidth - documentElement.clientWidth > 0`, re-read from
 *   a ResizeObserver on html + body (the document's height changes when a
 *   route renders or its content loads) and on window resize. The observer
 *   callback runs after layout and before paint, so a route lands already
 *   compensated — no flash.
 * - Scroll locks (Radix dialogs via react-remove-scroll) hide the bar and
 *   compensate on `body` themselves — as a margin-right in its default gap
 *   mode (measured: 11px on the wallet modal), as a padding in the other. The
 *   space body already gives up on the right, margin or padding, is subtracted
 *   so the two compensations never stack.
 * - Padding can itself change whether the page overflows (a narrower box can
 *   wrap a line and grow taller), which would flip the state back and forth
 *   forever. Guard: if the state flips more than a few times within a short
 *   window, it is pinned to the padded state until the next resize.
 */
export function usePageScrollbarCompensation(): void {
  useLayoutEffect(() => {
    if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') return;

    const root = document.documentElement;
    const barWidth = measureScrollbarWidth();
    if (barWidth === 0) return;

    let applied: number | null = null;
    let flips = 0;
    let flipWindow: ReturnType<typeof setTimeout> | undefined;
    let pinned = false;

    const apply = (px: number) => {
      if (applied === px) return;
      if (applied !== null) {
        flips += 1;
        clearTimeout(flipWindow);
        flipWindow = setTimeout(() => (flips = 0), 250);
        if (flips > 4) {
          // Oscillating: freeze on the padded state. A wrapped line under the
          // pad is invisible; a content column that jitters is not.
          pinned = true;
          px = barWidth;
        }
      }
      applied = px;
      root.style.setProperty(PAGE_SCROLLBAR_PAD_VAR, `${px}px`);
    };

    const update = () => {
      if (pinned) return;
      const hasBar = window.innerWidth - root.clientWidth > 0;
      const body = document.body;
      const bodyGap =
        root.clientWidth -
        body.getBoundingClientRect().right +
        (parseFloat(getComputedStyle(body).paddingRight) || 0);
      apply(hasBar ? 0 : Math.max(0, barWidth - Math.round(bodyGap)));
    };

    const onResize = () => {
      pinned = false;
      flips = 0;
      update();
    };

    const observer = new ResizeObserver(update);
    observer.observe(root);
    observer.observe(document.body);
    window.addEventListener('resize', onResize);
    update();

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', onResize);
      clearTimeout(flipWindow);
      root.style.removeProperty(PAGE_SCROLLBAR_PAD_VAR);
    };
  }, []);
}

/**
 * Width of a classic scrollbar in this browser, 0 when scrollbars are overlay.
 * The probe inherits the root's `scrollbar-width: thin` recipe via the
 * `:root *` rule, so it measures the same bar the viewport draws.
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
