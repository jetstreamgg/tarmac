import { createRootRouteWithContext, Outlet, redirect } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { legacySearchToLocation } from '@/lib/legacyRedirects';
import { usePageScrollbarGutter } from '@/modules/layout/hooks/usePageScrollbarGutter';

export type AppSearchParams = Record<string, string>;

/**
 * Dependencies the router hands to route lifecycle callbacks. `beforeLoad` runs
 * outside the React tree, so hooks like `useQueryClient` are unavailable there —
 * routes that need the cache (the geo gate) receive the client through context
 * instead of importing the module instance.
 */
export type AppRouterContext = {
  queryClient: QueryClient;
};

/**
 * The one component above every route, Layout or not (the design-system page
 * has none): document-level effects live here so they run once and never
 * remount with a page.
 */
function RootComponent() {
  // Publishes the page scrollbar column's width for the scroll-lock rules.
  usePageScrollbarGutter();
  return <Outlet />;
}

export const Route = createRootRouteWithContext<AppRouterContext>()({
  component: RootComponent,
  // Permissive passthrough: the router's parseSearch already guarantees string values.
  validateSearch: (search): AppSearchParams => search as AppSearchParams,
  // Translate legacy ?widget= deep links so external links and bookmarks keep
  // working. One hop, straight to the target IA: the intermediate path
  // generations never reached production, so there is nothing else to forward.
  beforeLoad: ({ search }) => {
    const target = legacySearchToLocation(search);
    if (target) {
      throw redirect({ to: target.to, search: target.search, replace: true });
    }
  }
});
