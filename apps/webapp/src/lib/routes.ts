import { Intent } from '@/lib/enums';

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
