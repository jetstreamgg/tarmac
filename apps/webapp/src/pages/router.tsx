import { createRootRoute, createRoute, createRouter, notFound, redirect } from '@tanstack/react-router';
import Home from './Home';
import ErrorPage from './ErrorPage';
import { NotFound } from '../modules/layout/components/NotFound';
import Dev from './Dev';
import { SealEngine } from './SealEngine';
import { BatchTransactionsLegal } from './BatchTransactionsLegal';
import { rewriteLegacyWidgetParams } from '@/modules/utils/validateSearchParams';

export type AppSearchParams = Record<string, string>;

// Keep search params as plain strings (URLSearchParams semantics) instead of
// TanStack's default JSON encoding, so values like `details=true` or token
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

const rootRoute = createRootRoute({
  // Permissive passthrough: parseSearch already guarantees string values.
  // Phase 2 of the path-navigation migration narrows this per route.
  validateSearch: (search): AppSearchParams => search as AppSearchParams
});

// TODO: Remove once all references to widget=trade|upgrade are migrated
const legacyWidgetBeforeLoad = ({ search }: { search: AppSearchParams }) => {
  const params = new URLSearchParams(search);
  const before = params.toString();
  rewriteLegacyWidgetParams(params);
  if (params.toString() !== before) {
    throw redirect({ to: '/', search: Object.fromEntries(params), replace: true });
  }
};

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: legacyWidgetBeforeLoad,
  component: Home
});

const sealEngineRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/seal-engine',
  component: SealEngine
});

const batchTransactionsLegalRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/batch-transactions-legal-notice',
  component: BatchTransactionsLegal
});

const devRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dev',
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  component: Dev
});

const routeTree = rootRoute.addChildren([indexRoute, sealEngineRoute, batchTransactionsLegalRoute, devRoute]);

export const router = createRouter({
  routeTree,
  parseSearch,
  stringifySearch,
  defaultErrorComponent: ErrorPage,
  defaultNotFoundComponent: NotFound
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
