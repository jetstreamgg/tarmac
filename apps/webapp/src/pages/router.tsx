import { createRouter, type RouterHistory } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { routeTree } from '../routeTree.gen';
import ErrorPage from './ErrorPage';
import { NotFound } from '../modules/layout/components/NotFound';
import { queryClient as appQueryClient } from '@/lib/queryClient';
import { isEarnDrilldown } from '@/lib/routes';
import type { AppSearchParams } from '../routes/__root';

export type { AppSearchParams } from '../routes/__root';

// Keep search params as plain strings (URLSearchParams semantics) instead of
// TanStack's default JSON encoding, so values like `network=ethereum` or token
// symbols round-trip byte-for-byte with the URLs the app produced before the
// router migration.
const parseSearch = (searchStr: string): AppSearchParams =>
  Object.fromEntries(new URLSearchParams(searchStr));

const stringifySearch = (search: Record<string, unknown>): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null) continue;
    params.set(key, String(value));
  }
  const str = params.toString();
  return str ? `?${str}` : '';
};

// Factory so tests can boot the app's real router config on a memory history,
// with their own query client so route-level cache reads stay hermetic.
export const createAppRouter = (history?: RouterHistory, queryClient: QueryClient = appQueryClient) => {
  // Every push and replace mints a fresh `__TSR_key` (@tanstack/history's
  // assignKeyAndIndex); a back/forward traversal restores the entry's stored
  // state and so arrives with a key we have already been handed. Recording the
  // keys as they go by is therefore enough to tell the two apart — the history
  // index cannot, because a push and a forward traversal both land on
  // `currentIndex + 1`. Per router instance, and one short string per history
  // entry.
  const seenLocationKeys = new Set<string>();

  const isHistoryTraversal = (key: string | undefined): boolean => {
    if (!key) return false;
    if (seenLocationKeys.has(key)) return true;
    seenLocationKeys.add(key);
    return false;
  };

  return createRouter({
    routeTree,
    history,
    // Handed to every beforeLoad/loader: those run outside React, so routes that
    // need the query cache take it from here rather than importing the instance.
    context: { queryClient },
    parseSearch,
    stringifySearch,
    // Prefetch lazy route chunks when links are hovered/focused
    defaultPreload: 'intent',
    // Page transitions (Figma: Sky App: UI 1598:75512, view=motion). The
    // animation itself is CSS on the `page` view-transition group in
    // globals.css; this only decides which navigations get a transition.
    //
    // Object form rather than `true` so the `types` callback can veto.
    // Returning `false` skips document.startViewTransition altogether.
    //
    // `fromLocation` is undefined on the very first load, and the router
    // derives `pathChanged` as `fromLocation?.pathname !== toLocation.pathname`
    // — so it reports true there and the app animated itself in on boot.
    // Requiring a previous location keeps the transition to real navigations.
    //
    // `pathChanged` then excludes navigations that only rewrite search params
    // (network switch, stake urn index, balance filters): same page, no slide.
    //
    // Back/forward is excluded as well, because scrollRestoration hands those
    // navigations a non-zero starting scroll and the CSS is built on the
    // incoming page being at the top. The restore lands *before* the incoming
    // snapshot is captured (measured: window.scrollY already reads the restored
    // offset when `transition.ready` resolves), which puts the group box that
    // both snapshots share that far up the viewport — so the outgoing page
    // jumps up by the restored amount on the transition's first frame. Leaving
    // traversals to swap instantly is what the browser does natively anyway;
    // compensating instead would mean placing both snapshots by hand against
    // an offset only TanStack's private restoration cache knows.
    defaultViewTransition: {
      types: ({ pathChanged, fromLocation, toLocation }) => {
        // Ahead of the vetoes: a key first seen on a navigation that does not
        // animate still has to count as seen, or returning to it later would
        // read as a fresh push.
        if (isHistoryTraversal(toLocation.state.__TSR_key)) return false;
        if (!fromLocation || !pathChanged) return false;
        // Runs synchronously immediately before startViewTransition, which is
        // the only moment the pre-navigation scroll position is still readable.
        // The page's outgoing snapshot is the whole tall element, so the CSS
        // needs this to show the part that was on screen — see the
        // ::view-transition-group(page) block in globals.css.
        document.documentElement.style.setProperty('--vt-scroll', `${window.scrollY}px`);
        // Drilling between the Earn marketplace and a product page travels
        // vertically instead (Figma: Sky App: UI 1598:77307). The second type
        // is additive — it only swaps which keyframes run, so the timing,
        // easing, overlap and snapshot handling stay shared with every other
        // navigation.
        return isEarnDrilldown(fromLocation.pathname, toLocation.pathname) ? ['page', 'drill'] : ['page'];
      }
    },
    // Full-width routes scroll on the document (no inner-scroll box), so the
    // router owns scroll position: reset to top on new navigations, restore on
    // back/forward. A no-op for boxed routes whose scroll lives in an element.
    scrollRestoration: true,
    defaultErrorComponent: ErrorPage,
    defaultNotFoundComponent: NotFound,
    // NotFound renders its own full-page Layout, so unmatched paths must surface
    // at the root; the default fuzzy mode would nest it inside the closest
    // partially-matching layout (e.g. /earn/bogus inside the app shell).
    notFoundMode: 'root'
  });
};

export const router = createAppRouter();

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
