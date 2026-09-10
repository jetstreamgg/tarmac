import { useLayoutEffect } from 'react';

export const PAGE_SCROLLBAR_GUTTER_VAR = '--page-scrollbar-gutter';
export const PAGE_SCROLLBAR_ATTR = 'data-page-scrollbar';

/**
 * Width of the page scrollbar's column, published on the root as
 * `--page-scrollbar-gutter` (plus `data-page-scrollbar="classic" | "overlay"`)
 * for the scrollbar rules in globals.css. Mounted once from the root route,
 * above every page — including ones outside Layout, whose dialogs lock the
 * page too — and never remounted, so a lock can't outlive the value.
 *
 * The root reserves the column on every route (`scrollbar-gutter: stable`) and
 * releases it while a dialog or the takeover holds a scroll lock, so the scrim
 * can cover the whole window; the page then has to keep the column's width as
 * a body margin to stay put, and a dialog backs off by half of it to centre on
 * the page. react-remove-scroll measures that width itself, but as
 * `innerWidth - documentElement.clientWidth`, which is 0 on a route that does
 * not scroll: the reserved column is not a scrollbar, so the root's
 * `clientWidth` does not exclude it there — only body's does. That left the
 * page shifting right under a modal on Convert and Stake › About.
 *
 * `innerWidth - body.clientWidth` is the column whether or not a bar is in it
 * (measured 11px for Chrome's thin classic bar; 0 with overlay bars, where
 * nothing is reserved). Body has no horizontal margin outside a lock, and
 * the lock's margin is the one thing this feeds, so it is read outside locks
 * only. Reads happen when body's box changes (a ResizeObserver — macOS flips
 * overlay ↔ classic bars when a mouse is plugged in or out without a window
 * resize, and the column's width is the one thing that changes) and when a
 * lock is released (a resize during the lock was skipped), so the value never
 * goes stale across a lock.
 */
export function usePageScrollbarGutter(): void {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const measure = () => {
      if (body.hasAttribute('data-scroll-locked')) return;
      const gutter = Math.max(0, window.innerWidth - body.clientWidth);
      root.style.setProperty(PAGE_SCROLLBAR_GUTTER_VAR, `${gutter}px`);
      root.setAttribute(PAGE_SCROLLBAR_ATTR, gutter > 0 ? 'classic' : 'overlay');
    };
    measure();
    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : undefined;
    resize?.observe(body);
    window.addEventListener('resize', measure);
    const lock = new MutationObserver(measure);
    lock.observe(body, { attributes: true, attributeFilter: ['data-scroll-locked'] });
    return () => {
      resize?.disconnect();
      lock.disconnect();
      window.removeEventListener('resize', measure);
      // The value is left in place: the rules keyed on it must not lose it
      // mid-lock if the tree ever remounts.
    };
  }, []);
}
