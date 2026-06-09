import { createRootRoute, createRoute, createRouter, notFound, redirect } from '@tanstack/react-router';
import { keepSearch } from '@/lib/navigation';
import Home from './Home';
import ErrorPage from './ErrorPage';
import { NotFound } from '../modules/layout/components/NotFound';
import Dev from './Dev';
import { SealEngine } from './SealEngine';
import { BatchTransactionsLegal } from './BatchTransactionsLegal';
import { legacySearchToLocation } from '@/lib/legacyRedirects';
import { ConvertIntent, ExpertIntent, FixedIntent, Intent } from '@/lib/enums';
import { providerForVaultModule } from '@/lib/vaults/vaultProviderMapping';
import { PENDLE_MARKETS, isMarketMatured } from '@/hooks';

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

// Pathless layout: every module route renders the app shell; the active module
// and its entities are derived from the matched route (staticData + params),
// not from the route's own component.
const shellRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'shell',
  component: Home
});

const balancesRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/',
  staticData: { intent: Intent.BALANCES_INTENT }
});

const savingsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/savings',
  staticData: { intent: Intent.SAVINGS_INTENT }
});

const rewardsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/rewards',
  staticData: { intent: Intent.REWARDS_INTENT }
});

// Reward contract validity is chain-dependent (wagmi state), so it is enforced
// in MainApp's route-validation effect rather than here.
const rewardsDetailRoute = createRoute({
  getParentRoute: () => rewardsRoute,
  path: '$rewardContract',
  staticData: { intent: Intent.REWARDS_INTENT }
});

const stakeRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/stake',
  staticData: { intent: Intent.STAKE_INTENT }
});

const convertRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/convert',
  staticData: { intent: Intent.CONVERT_INTENT }
});

const convertPsmRoute = createRoute({
  getParentRoute: () => convertRoute,
  path: 'psm',
  staticData: { convertIntent: ConvertIntent.PSM_INTENT }
});

const convertTradeRoute = createRoute({
  getParentRoute: () => convertRoute,
  path: 'trade',
  staticData: { convertIntent: ConvertIntent.TRADE_INTENT }
});

// Upgrade is mainnet-only; the L2 redirect lives in MainApp's route-validation
// effect where the connected chain is known.
const convertUpgradeRoute = createRoute({
  getParentRoute: () => convertRoute,
  path: 'upgrade',
  staticData: { convertIntent: ConvertIntent.UPGRADE_INTENT }
});

const expertRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/expert',
  staticData: { intent: Intent.EXPERT_INTENT }
});

// Gated on the expert risk disclaimer in MainApp's route-validation effect
// (user settings live in React context).
const expertStusdsRoute = createRoute({
  getParentRoute: () => expertRoute,
  path: 'stusds',
  staticData: { expertIntent: ExpertIntent.STUSDS_INTENT }
});

const vaultsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/vaults',
  staticData: { intent: Intent.VAULTS_INTENT }
});

const vaultsDetailRoute = createRoute({
  getParentRoute: () => vaultsRoute,
  path: '$provider/$vaultAddress',
  // An unrecognised provider segment falls back to the vaults overview, like
  // the legacy vault_module validation. Vault address validity is handled by
  // the vault panes (chain-dependent).
  beforeLoad: ({ params }) => {
    if (!providerForVaultModule(params.provider)) {
      throw redirect({ to: '/vaults', search: keepSearch, replace: true });
    }
  },
  staticData: { intent: Intent.VAULTS_INTENT }
});

const fixedRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: '/fixed',
  staticData: { intent: Intent.FIXED_INTENT }
});

const fixedMarketRoute = createRoute({
  getParentRoute: () => fixedRoute,
  path: 'market/$marketAddress',
  // Matured markets have no detail view — they only render as redeem rows on
  // the overview — and unknown addresses fall back to the overview too.
  beforeLoad: ({ params }) => {
    const lower = params.marketAddress.toLowerCase();
    const market = PENDLE_MARKETS.find(m => m.marketAddress.toLowerCase() === lower);
    if (!market || isMarketMatured(market.expiry)) {
      throw redirect({ to: '/fixed', search: keepSearch, replace: true });
    }
  },
  staticData: { fixedIntent: FixedIntent.MARKET_INTENT }
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

const routeTree = rootRoute.addChildren([
  shellRoute.addChildren([
    balancesRoute,
    savingsRoute,
    rewardsRoute.addChildren([rewardsDetailRoute]),
    stakeRoute,
    convertRoute.addChildren([convertPsmRoute, convertTradeRoute, convertUpgradeRoute]),
    expertRoute.addChildren([expertStusdsRoute]),
    vaultsRoute.addChildren([vaultsDetailRoute]),
    fixedRoute.addChildren([fixedMarketRoute])
  ]),
  sealEngineRoute,
  batchTransactionsLegalRoute,
  devRoute
]);

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
