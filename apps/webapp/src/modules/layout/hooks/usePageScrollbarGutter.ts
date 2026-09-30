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
 * a body margin to stay put, and every fixed layer anchored to the viewport's
 * right edge or centre backs off by it (`--page-released-gutter`, this value
 * while a lock is held). react-remove-scroll measures that width itself, but as
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
 *
 * The first reading is taken before React mounts: main.tsx calls
 * `publishPageScrollbarGutter`, and the hook then only re-reads on changes.
 */
export function usePageScrollbarGutter(): void {
  useLayoutEffect(() => {
    // Unless main.tsx already published it (tests, another root), read it now.
    if (!document.documentElement.hasAttribute(PAGE_SCROLLBAR_ATTR)) publishPageScrollbarGutter();
    const body = document.body;
    const measure = () => publishPageScrollbarGutter();
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

/**
 * Reads the column and publishes it on the root, writing only what changed.
 *
 * main.tsx calls this before the app renders. Reading `clientWidth` forces a
 * layout: on the empty page that costs nothing, while the same read in the
 * root route's layout effect laid out the whole first page synchronously
 * (~65 ms on a throttled phone), and the write that followed invalidated the
 * style of every element under the root, so the next layout read computed it
 * all again. The value is the same either way: the root reserves the column
 * (`scrollbar-gutter: stable`) whatever the page holds. Unchanged values are
 * not rewritten, so the ResizeObserver's first callback, which runs after the
 * first layout, doesn't invalidate it again.
 */
export function publishPageScrollbarGutter(): void {
  const root = document.documentElement;
  const body = document.body;
  if (body.hasAttribute('data-scroll-locked')) return;
  const gutter = Math.max(0, window.innerWidth - body.clientWidth);
  const value = `${gutter}px`;
  const kind = gutter > 0 ? 'classic' : 'overlay';
  if (root.style.getPropertyValue(PAGE_SCROLLBAR_GUTTER_VAR) !== value) {
    root.style.setProperty(PAGE_SCROLLBAR_GUTTER_VAR, value);
  }
  if (root.getAttribute(PAGE_SCROLLBAR_ATTR) !== kind) root.setAttribute(PAGE_SCROLLBAR_ATTR, kind);
}
