import { createRouter, type RouterHistory } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { routeTree } from '../routeTree.gen';
import ErrorPage from './ErrorPage';
import { NotFound } from '../modules/layout/components/NotFound';
import { queryClient as appQueryClient } from '@/lib/queryClient';
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
export const createAppRouter = (history?: RouterHistory, queryClient: QueryClient = appQueryClient) =>
  createRouter({
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
    defaultViewTransition: {
      types: ({ pathChanged, fromLocation }) => (fromLocation && pathChanged ? ['page'] : false)
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

export const router = createAppRouter();

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
