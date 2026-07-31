import { createRootRouteWithContext, redirect } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { legacyPathToLocation, legacySearchToLocation } from '@/lib/legacyRedirects';

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

export const Route = createRootRouteWithContext<AppRouterContext>()({
  // Permissive passthrough: the router's parseSearch already guarantees string values.
  validateSearch: (search): AppSearchParams => search as AppSearchParams,
  // Translate legacy deep links so external links and bookmarks keep working:
  // ?widget= URLs first rewrite to their pre-flip path, then pre-flip module
  // paths (/savings, /rewards/0x…) map forward to their /earn destinations —
  // composed here so either generation lands in a single redirect.
  beforeLoad: ({ search, location }) => {
    const legacy = legacySearchToLocation(search);
    const base = legacy ?? { to: location.pathname, search };
    const target = legacyPathToLocation(base.to, base.search) ?? legacy;
    if (target) {
      throw redirect({ to: target.to, search: target.search, replace: true });
    }
  }
});
