import { Intent } from '@/lib/enums';
import type { EarnProductKind } from '@/hooks/earn/types';

// Target-IA route map (plan §4.1). Single source of truth: downstream code
// imports route knowledge from here — never hardcode paths.
export const ROUTES = {
  PORTFOLIO: '/portfolio',
  EARN: '/earn',
  EARN_SAVINGS: '/earn/savings',
  EARN_REWARDS: '/earn/rewards',
  EARN_VAULTS: '/earn/vaults',
  // Bare index redirects to /earn (G6 — the overview was retired); markets
  // live at /earn/fixed/:slug via intentToPath(FIXED_INTENT, slug).
  EARN_FIXED: '/earn/fixed',
  EARN_STUSDS: '/earn/stusds',
  STAKE: '/stake',
  CONVERT: '/convert',
  SEAL_ENGINE: '/seal-engine',
  DEV: '/dev'
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

/**
 * Anchor id of the Earn Opportunities heading. Deep links that pre-select the
 * stablecoin filter (portfolio's idle Supply button, the wallet drawer's asset
 * rows) navigate to `/earn?token=<SYMBOL>#earn-opportunities` so the router's
 * built-in hash scrolling lands them past the hero and featured tiles, at the
 * filtered table (APP-487). Pushes and replaces scroll to the anchor;
 * back/forward restores the saved position instead; and the filter bar's own
 * search replaces drop the hash, so filter edits after arrival never
 * re-scroll.
 */
export const EARN_OPPORTUNITIES_HASH = 'earn-opportunities';

/**
 * The four top-level destinations in nav order (plan §4.2). `DESTINATIONS`
 * (modules/app/shell/destinations.tsx) renders them in exactly this order and a
 * test holds the two together; the order lives here because the router needs it
 * outside the React tree, to decide which way a page transition travels.
 */
export const DESTINATION_ORDER: RoutePath[] = [ROUTES.PORTFOLIO, ROUTES.EARN, ROUTES.STAKE, ROUTES.CONVERT];

// Intents with their own destination. TRADE/UPGRADE have none: they folded
// into Convert before this migration and alias to its path.
const PATH_BY_INTENT: Record<Intent, RoutePath> = {
  [Intent.BALANCES_INTENT]: ROUTES.PORTFOLIO,
  [Intent.SAVINGS_INTENT]: ROUTES.EARN_SAVINGS,
  [Intent.REWARDS_INTENT]: ROUTES.EARN_REWARDS,
  [Intent.VAULTS_INTENT]: ROUTES.EARN_VAULTS,
  [Intent.FIXED_INTENT]: ROUTES.EARN_FIXED,
  [Intent.EXPERT_INTENT]: ROUTES.EARN_STUSDS,
  [Intent.STAKE_INTENT]: ROUTES.STAKE,
  [Intent.CONVERT_INTENT]: ROUTES.CONVERT,
  [Intent.TRADE_INTENT]: ROUTES.CONVERT,
  [Intent.UPGRADE_INTENT]: ROUTES.CONVERT
};

// `sub` is a configured product-instance slug, appended as a path segment
// (slug-as-path, plan §4.1 / decision log).
export function intentToPath(intent: Intent, sub?: string): string {
  const base = PATH_BY_INTENT[intent];
  return sub ? `${base}/${sub}` : base;
}

/**
 * Earn families with no overview screen of their own: their bare destination is
 * the marketplace filtered to the family (APP-542). A legacy `?widget=vaults`
 * link asked for vaults specifically, so it lands on the table pre-filtered
 * rather than on the unfiltered marketplace — the same place the sky.money CTAs
 * now point.
 *
 * The values are `EarnProductKind`, which `sanitizeFilters` matches exactly
 * against the live option set — note the singular `vault`, which is the product
 * kind, not the `vaults` module name.
 */
const EARN_PRODUCT_BY_INTENT: Partial<Record<Intent, EarnProductKind>> = {
  [Intent.VAULTS_INTENT]: 'vault',
  [Intent.REWARDS_INTENT]: 'rewards',
  [Intent.FIXED_INTENT]: 'fixed'
};

/** The Earn table's product filter for `intent`, or undefined when it has its own page. */
export const earnProductFilter = (intent: Intent): EarnProductKind | undefined =>
  EARN_PRODUCT_BY_INTENT[intent];

const ALIAS_INTENTS: ReadonlySet<Intent> = new Set([Intent.TRADE_INTENT, Intent.UPGRADE_INTENT]);

// Canonical destination → intent, aliases excluded so the inverse is exact.
// Longest base first so nested destinations win over any future parent.
const INTENT_ROUTES = (Object.entries(PATH_BY_INTENT) as [Intent, RoutePath][])
  .filter(([intent]) => !ALIAS_INTENTS.has(intent))
  .sort(([, a], [, b]) => b.length - a.length);

const normalizePath = (pathname: string) => pathname.toLowerCase().replace(/\/+$/, '');

// Classifies a pathname into the Intent its screen consumes (validation,
// analytics, network mapping). Returns null for intent-less routes; route
// existence/404 stays the router's concern.
export function pathToIntent(pathname: string): Intent | null {
  const path = normalizePath(pathname);
  for (const [intent, base] of INTENT_ROUTES) {
    if (path === base || path.startsWith(`${base}/`)) return intent;
  }
  return null;
}

/**
 * True when a navigation moves between the Earn marketplace and one of its
 * product pages, in either direction — the drill-down that the motion comp
 * (Figma: Sky App: UI 1598:77307) slides vertically rather than sideways.
 *
 * Deliberately narrow: arriving at a product page from anywhere else (the
 * Portfolio, a deep link, the nav) is a lateral move and keeps the horizontal
 * slide. There is no product-to-product case to weigh, because every bare
 * sub-path (/earn/vaults, /earn/rewards, /earn/fixed) redirects to /earn — the
 * only Earn screens that exist are the marketplace and the product leaves.
 */
export function isEarnDrilldown(fromPathname: string, toPathname: string): boolean {
  const from = normalizePath(fromPathname);
  const to = normalizePath(toPathname);
  const isProduct = (path: string) => path.startsWith(`${ROUTES.EARN}/`);
  return (from === ROUTES.EARN && isProduct(to)) || (to === ROUTES.EARN && isProduct(from));
}

/** True for the Earn marketplace itself, not one of its product pages. */
export function isEarnMarketplacePath(pathname: string): boolean {
  return normalizePath(pathname) === ROUTES.EARN;
}

const destinationIndex = (pathname: string): number => {
  const path = normalizePath(pathname);
  return DESTINATION_ORDER.findIndex(base => path === base || path.startsWith(`${base}/`));
};

/**
 * True when a navigation runs *against* the app's reading order, which the page
 * transition plays as the mirror of the forward move (APP-457): Earn →
 * Portfolio is Portfolio → Earn backwards, and a product page → /earn is the
 * drill-down backwards.
 *
 * Laterally that order is the nav's own (DESTINATION_ORDER), so the pages
 * travel the way the destinations are laid out rather than always one way.
 * Paths under no destination (`/`, /seal-engine, /dev) have no place in it and
 * keep the forward direction, which is what every navigation did before.
 */
export function isReverseNavigation(fromPathname: string, toPathname: string): boolean {
  if (isEarnDrilldown(fromPathname, toPathname)) return normalizePath(toPathname) === ROUTES.EARN;
  const from = destinationIndex(fromPathname);
  const to = destinationIndex(toPathname);
  return from >= 0 && to >= 0 && to < from;
}
