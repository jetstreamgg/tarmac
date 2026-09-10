import { useLayoutEffect } from 'react';

export const PAGE_SCROLLBAR_GUTTER_VAR = '--page-scrollbar-gutter';

/**
 * Width of the page scrollbar's column, published on the root as
 * `--page-scrollbar-gutter` for the scroll-lock rules in globals.css.
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
 * only — on mount and on resize, which is where the bar can come and go.
 */
export function usePageScrollbarGutter(): void {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const measure = () => {
      if (document.body.hasAttribute('data-scroll-locked')) return;
      const gutter = Math.max(0, window.innerWidth - document.body.clientWidth);
      root.style.setProperty(PAGE_SCROLLBAR_GUTTER_VAR, `${gutter}px`);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      root.style.removeProperty(PAGE_SCROLLBAR_GUTTER_VAR);
    };
  }, []);
}
