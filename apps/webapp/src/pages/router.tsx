import { createRouter, type RouterHistory } from '@tanstack/react-router';
import { routeTree } from '../routeTree.gen';
import ErrorPage from './ErrorPage';
import { NotFound } from '../modules/layout/components/NotFound';
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

// Factory so tests can boot the app's real router config on a memory history.
export const createAppRouter = (history?: RouterHistory) =>
  createRouter({
    routeTree,
    history,
    parseSearch,
    stringifySearch,
    // Prefetch lazy route chunks when links are hovered/focused
    defaultPreload: 'intent',
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
