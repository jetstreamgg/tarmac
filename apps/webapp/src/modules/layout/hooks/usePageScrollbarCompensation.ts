import { useLayoutEffect } from 'react';

/** CSS custom property the shell reads as a `padding-right` on the header bar and the page column. */
export const PAGE_SCROLLBAR_PAD_VAR = '--page-scrollbar-pad';

/**
 * Custom property react-remove-scroll (Radix dialogs) publishes on body while a
 * scroll lock is up: the width of the bar it hid, which it hands back to body
 * as a margin so the page does not widen under the scrim. Empty when unlocked.
 */
const LOCK_GAP_VAR = '--removed-body-scroll-bar-size';

/**
 * Keeps the page content in the same horizontal position whether or not the
 * document currently has a scrollbar.
 *
 * Routes that fit the viewport (Convert at desktop heights) have no page
 * scrollbar; routes that overflow do, and with classic (space-taking)
 * scrollbars the bar narrows the viewport by its width, so the centred
 * content shifts sideways on every navigation between the two kinds.
 *
 * `scrollbar-gutter: stable` is the property for this, and it was tried: it
 * reserves the space and even centres fixed elements on the reduced viewport.
 * But the gutter lies outside the scrollport, so nothing can paint into it —
 * not the viewport-fixed .app-background image, not a body background image,
 * not an element hung past the edge (all measured) — and Chrome fills it with
 * the canvas colour alone. On a non-scrolling route that is a flat strip
 * against the sky image, which design rejected. `overflow-y: scroll` gives a
 * thumbless track strip, same objection.
 *
 * So instead: when the bar is absent, the header bar and the page column pad
 * their right edge by exactly the bar's width and the fixed background image
 * shows through the pad; when the bar is present the pad is 0 and the bar
 * sits in the same columns. Fixed and portaled surfaces that centre on the
 * viewport (the dialog card, the mobile navbar pill, the banner) read the
 * same variable to stay aligned with the page; see their class lists.
 *
 * Mechanics:
 * - Presence: `innerWidth - documentElement.clientWidth`, read against a
 *   threshold of half the bar rather than `> 0` — at 110% or 125% browser
 *   zoom the two round independently and can differ by 1px with no bar.
 * - The bar's width comes from a probe box, measured only when no bar is
 *   present (it is irrelevant otherwise) and cached per viewport width:
 *   macOS flips between overlay and classic bars live when a mouse is
 *   plugged in, and that changes the viewport width. Overlay bars measure 0
 *   and the pad stays 0.
 * - Updates run from a ResizeObserver on html + body (the document's height
 *   changes when a route renders or its content loads), a MutationObserver
 *   on body's scroll-lock attribute (a lock on a no-bar route resizes
 *   nothing), and window resize. The write inside the observer callback can
 *   re-layout body, which Chrome may report as a "ResizeObserver loop"
 *   console error; deferring it a frame would show one frame of shifted
 *   content on every navigation, so the synchronous write is deliberate.
 * - Scroll locks hide the bar and give body a margin of the same width; that
 *   width is read back from the property react-remove-scroll publishes and
 *   subtracted, so the two compensations never stack.
 * - Padding can itself change whether the page overflows (a narrower box can
 *   wrap a line and grow taller), which would flip the state back and forth
 *   forever. A genuine loop reverses direction on consecutive frames; a burst
 *   of legitimate changes moves one way. So only repeated quick reversals
 *   count, and when they do the pad is pinned to 0 — the uncompensated
 *   layout, never a pad on top of a present bar. A pin lifts after a quiet
 *   period (a real loop re-pins within a few frames; a person toggling an
 *   accordion settles), and the effect re-runs on navigation and a lock
 *   change, which starts it from a clean closure.
 *
 * @param resetKey Changes on navigation (the route path); restarts the effect.
 */
export function usePageScrollbarCompensation(resetKey?: unknown): void {
  useLayoutEffect(() => {
    if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') return;

    const root = document.documentElement;
    const body = document.body;
    let applied: number | null = null;
    let before: number | null = null; // the value `applied` replaced
    let reversals = 0;
    let lastChange = 0;
    let pinned = false;
    let quietTimer: ReturnType<typeof setTimeout> | undefined;
    let cachedBar: { viewportWidth: number; width: number } | null = null;

    const barWidth = () => {
      if (cachedBar?.viewportWidth !== root.clientWidth) {
        cachedBar = { viewportWidth: root.clientWidth, width: measureScrollbarWidth() };
      }
      return cachedBar.width;
    };

    const write = (px: number) => {
      before = applied;
      applied = px;
      root.style.setProperty(PAGE_SCROLLBAR_PAD_VAR, `${px}px`);
    };

    const update = () => {
      if (pinned) return;
      const gap = window.innerWidth - root.clientWidth;
      let next = 0;
      if (gap < 1) {
        const bar = barWidth();
        const lockGap = parseFloat(getComputedStyle(body).getPropertyValue(LOCK_GAP_VAR)) || 0;
        next = Math.max(0, bar - lockGap);
      } else if (applied !== null && gap < Math.max(1, barWidth() / 2)) {
        return; // zoom rounding noise, not a bar
      }
      if (next === applied) return;

      const now = performance.now();
      reversals = next === before && now - lastChange < REVERSAL_WINDOW_MS ? reversals + 1 : 0;
      lastChange = now;
      if (reversals >= REVERSALS_TO_PIN) {
        pinned = true;
        write(0);
        clearTimeout(quietTimer);
        quietTimer = setTimeout(() => {
          pinned = false;
          reversals = 0;
          update();
        }, QUIET_PERIOD_MS);
        return;
      }
      write(next);
    };

    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(root);
    resizeObserver.observe(body);
    const lockObserver = new MutationObserver(update);
    lockObserver.observe(body, { attributes: true, attributeFilter: ['data-scroll-locked'] });
    window.addEventListener('resize', update);
    update();

    return () => {
      resizeObserver.disconnect();
      lockObserver.disconnect();
      window.removeEventListener('resize', update);
      clearTimeout(quietTimer);
      root.style.removeProperty(PAGE_SCROLLBAR_PAD_VAR);
    };
  }, [resetKey]);
}

/** A change that undoes the previous one within this window is a reversal. */
const REVERSAL_WINDOW_MS = 500;
/** Consecutive reversals before the state is treated as a feedback loop. */
const REVERSALS_TO_PIN = 3;
/** How long a pin holds before the state is re-tried. */
const QUIET_PERIOD_MS = 2 * REVERSAL_WINDOW_MS;

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
