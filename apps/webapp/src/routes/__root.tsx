import { createRootRoute, redirect } from '@tanstack/react-router';
import { legacySearchToLocation } from '@/lib/legacyRedirects';

export type AppSearchParams = Record<string, string>;

export const Route = createRootRoute({
  // Permissive passthrough: the router's parseSearch already guarantees string values.
  validateSearch: (search): AppSearchParams => search as AppSearchParams,
  // Translate pre-path-navigation deep links (?widget=...) to their path
  // equivalents so external links and bookmarks keep working.
  beforeLoad: ({ search }) => {
    const legacy = legacySearchToLocation(search);
    if (legacy) {
      throw redirect({ to: legacy.to, search: legacy.search, replace: true });
    }
  }
});
