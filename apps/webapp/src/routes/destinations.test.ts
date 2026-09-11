import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, type AnyRouter } from '@tanstack/react-router';
import { createAppRouter } from '@/pages/router';
import { Intent } from '@/lib/enums';
import { ROUTES } from '@/lib/routes';
import { PENDLE_MARKETS } from '@/hooks/pendle/constants';
import { MORPHO_VAULTS } from '@/hooks/morpho/constants';
import { QueryClient } from '@tanstack/react-query';
import { GEO_CONFIG_QUERY_KEY } from '@/modules/geo-config/query';
import type { GeoConfig, ModuleId } from '@/modules/geo-config/types';

const MODULE_IDS: ModuleId[] = [
  'savings',
  'rewards',
  'expert',
  'trade',
  'upgrade',
  'stake',
  'vaults',
  'fixed'
];

// The module routes gate on geo config in `beforeLoad` (G5, replacing the shell's
// old Balances-pane swap). Each spec boots its own client — the router takes one
// through context — and seeds the cache, so the guard reads it instead of hitting
// the network, which would resolve to the restrictive fallback and redirect half
// of them. No shared state between specs.
let queryClient: QueryClient;

function seedGeoConfig(disabled: ModuleId[] = []) {
  const config: GeoConfig = {
    version: 'test',
    countryCode: 'XX',
    generatedAt: new Date(0).toISOString(),
    cacheTtl: 60,
    isRegionRestricted: disabled.length > 0,
    modules: Object.fromEntries(
      MODULE_IDS.map(id => [id, { enabled: !disabled.includes(id) }])
    ) as GeoConfig['modules'],
    isCookiesBannerRequired: false
  };
  queryClient.setQueryData(GEO_CONFIG_QUERY_KEY, config);
}

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  seedGeoConfig();
});

// Boots the app's real router (route tree + redirects + not-found config)
// against a path without rendering, so a missing destination route or broken
// redirect fails here instead of 404ing on a preview deploy.
async function routerAt(path: string): Promise<AnyRouter> {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }), queryClient);
  await router.load();
  return router;
}

const matchedRouteIds = (router: AnyRouter): string[] =>
  router.state.matches.map(match => match.routeId as string);

// `notFoundMode: 'root'` flags the root match rather than clearing the partial
// ones, so a path that resolves to the 404 screen is read from the flag — the
// stale ancestor matches below it say nothing about what rendered. The flag is
// `_notFound` as of @tanstack/react-router 1.170.32 (was `globalNotFound`).
const isNotFound = (router: AnyRouter): boolean =>
  router.state.matches.some(match => (match as { _notFound?: boolean })._notFound === true);

describe('target-IA destination routes', () => {
  it('boots /portfolio as a shell route', async () => {
    expect(matchedRouteIds(await routerAt(ROUTES.PORTFOLIO))).toContain('/_shell/portfolio');
  });

  it('boots /earn as a shell route', async () => {
    expect(matchedRouteIds(await routerAt(ROUTES.EARN))).toContain('/_shell/earn/');
  });

  it.each([
    [ROUTES.EARN_SAVINGS, '/_shell/earn/savings'],
    [ROUTES.EARN_STUSDS, '/_shell/earn/stusds']
  ])('boots the %s module under the Earn destination', async (path, routeId) => {
    expect(matchedRouteIds(await routerAt(path))).toContain(routeId);
  });

  it('boots the per-farm rewards detail route under the Earn destination (D6)', async () => {
    const reward = '0x0650CAF159C5A49f711e8169D4336ECB9b950275';
    expect(matchedRouteIds(await routerAt(`${ROUTES.EARN_REWARDS}/${reward}`))).toContain(
      '/_shell/earn/rewards/$rewardContract'
    );
  });

  // The bare family paths have no overview screen (D6 / G6). They land on the
  // marketplace filtered to the family the URL named, rather than on the
  // unfiltered table (APP-542).
  it.each([
    [ROUTES.EARN_REWARDS, 'rewards'],
    [ROUTES.EARN_FIXED, 'fixed'],
    [ROUTES.EARN_VAULTS, 'vault']
  ])('redirects the bare %s index to the marketplace filtered to %s', async (path, product) => {
    const router = await routerAt(`${path}?network=ethereum`);
    expect(router.state.location.pathname).toBe(ROUTES.EARN);
    expect(router.state.location.search).toEqual({ network: 'ethereum', product });
  });

  it('declares the Balances intent on /portfolio for shell orchestration', async () => {
    const router = await routerAt(ROUTES.PORTFOLIO);
    const match = router.state.matches.find(m => (m.routeId as string) === '/_shell/portfolio');
    expect(match?.staticData?.intent).toBe(Intent.BALANCES_INTENT);
  });

  // G5 retired `staticData.fullWidth`: every route is a full-width page on the
  // document scroll, so there is no per-route flag left to assert.
  it.each([
    [ROUTES.PORTFOLIO, '/_shell/portfolio'],
    [ROUTES.EARN, '/_shell/earn/']
  ])('no longer carries a fullWidth flag on %s', async (path, routeId) => {
    const router = await routerAt(path);
    const match = router.state.matches.find(m => (m.routeId as string) === routeId);
    expect(match).toBeDefined();
    expect(match?.staticData).not.toHaveProperty('fullWidth');
  });
});

describe('stake destination (F7 flip)', () => {
  it('boots /stake as a shell route with the Stake intent', async () => {
    const router = await routerAt('/stake');
    const match = router.state.matches.find(m => (m.routeId as string) === '/_shell/stake');
    expect(match).toBeDefined();
    expect(match?.staticData?.intent).toBe(Intent.STAKE_INTENT);
  });

  it('preserves stake deep-link params on /stake', async () => {
    const router = await routerAt('/stake?flow=manage&urn_index=0&stake_tab=free&network=ethereum');
    expect(router.state.location.pathname).toBe('/stake');
    expect(router.state.location.search).toEqual({
      flow: 'manage',
      urn_index: '0',
      stake_tab: 'free',
      network: 'ethereum'
    });
  });

  it('resolves the retired /stake-v2 dev mount outside the shell (not found)', async () => {
    const router = await routerAt('/stake-v2');
    expect(matchedRouteIds(router).some(id => id.startsWith('/_shell'))).toBe(false);
  });
});

describe('root path', () => {
  // Routing & IA decision #3 (APP-295): Earn is the default home; Portfolio
  // only for a browser whose last settled wallet had a significant position.
  it('redirects "/" to Earn when nothing is known about the visitor', async () => {
    localStorage.clear();
    const router = await routerAt('/');
    expect(router.state.location.pathname).toBe(ROUTES.EARN);
  });

  it('redirects "/" to Portfolio when the last settled wallet had a position', async () => {
    localStorage.setItem(
      'portfolioDecision:v1:$last',
      JSON.stringify({ outcome: 'none', tab: 'supplied', updatedAt: Date.now(), address: '0xabc' })
    );
    const router = await routerAt('/');
    expect(router.state.location.pathname).toBe(ROUTES.PORTFOLIO);
    localStorage.clear();
  });

  it('redirects "/" to Earn when the last settled wallet had nothing supplied', async () => {
    localStorage.setItem(
      'portfolioDecision:v1:$last',
      JSON.stringify({ outcome: 'allocate', tab: 'idle', updatedAt: Date.now(), address: '0xabc' })
    );
    const router = await routerAt('/');
    expect(router.state.location.pathname).toBe(ROUTES.EARN);
    localStorage.clear();
  });

  it('preserves global search params through the root redirect', async () => {
    localStorage.clear();
    const router = await routerAt('/?network=base');
    expect(router.state.location.pathname).toBe(ROUTES.EARN);
    expect(router.state.location.search).toEqual({ network: 'base' });
  });
});

describe('legacy ?widget= deep links', () => {
  // The query-param scheme is the only URL generation that ever reached
  // production, so it is the only one with a compatibility layer. Every case
  // resolves in one hop through the real router — no chain of path redirects.
  it.each([
    ['/?widget=balances', ROUTES.PORTFOLIO],
    ['/?widget=savings', ROUTES.EARN_SAVINGS],
    ['/?widget=stake', '/stake'],
    ['/?widget=trade', ROUTES.CONVERT],
    ['/?widget=upgrade', ROUTES.CONVERT],
    ['/?widget=convert&convert_module=psm', ROUTES.CONVERT],
    ['/?widget=expert', ROUTES.EARN_STUSDS],
    ['/?widget=expert&expert_module=stusds', ROUTES.EARN_STUSDS]
  ])('resolves %s to %s', async (from, to) => {
    const router = await routerAt(from);
    expect(router.state.location.pathname).toBe(to);
  });

  it('carries an entity deep link through to its product page, preserving search', async () => {
    const reward = '0x0650CAF159C5A49f711e8169D4336ECB9b950275';
    const router = await routerAt(`/?widget=rewards&reward=${reward}&network=ethereum`);
    expect(router.state.location.pathname).toBe(`${ROUTES.EARN_REWARDS}/${reward}`);
    expect(router.state.location.search).toEqual({ network: 'ethereum' });
  });

  it('resolves a legacy market address to its slug page', async () => {
    const market = PENDLE_MARKETS[0];
    const router = await routerAt(`/?widget=fixed&fixed_module=market&market=${market.marketAddress}`);
    expect(router.state.location.pathname).toBe(`${ROUTES.EARN_FIXED}/${market.slug}`);
  });

  it('resolves a legacy vault deep link to its detail page', async () => {
    const vaultAddress = Object.values(MORPHO_VAULTS[0].vaultAddress)[0]!;
    const router = await routerAt(`/?widget=vaults&vault_module=morpho&vault=${vaultAddress}`);
    expect(router.state.location.pathname).toBe(`${ROUTES.EARN_VAULTS}/morpho/${vaultAddress}`);
  });

  // APP-542: the sky.money CTAs used these three widgets, and landing on the
  // unfiltered marketplace read as a broken link.
  it.each([
    ['/?widget=fixed&network=ethereum', 'fixed'],
    ['/?widget=vaults&network=ethereum', 'vault'],
    ['/?widget=rewards&network=ethereum', 'rewards']
  ])('resolves %s to the marketplace filtered to %s', async (from, product) => {
    const router = await routerAt(from);
    expect(router.state.location.pathname).toBe(ROUTES.EARN);
    expect(router.state.location.search).toEqual({ network: 'ethereum', product });
  });

  it('filters rather than drops when the entity params are unusable', async () => {
    // `spark` is the pre-rename vault_module value; no provider resolves it.
    const router = await routerAt('/?widget=vaults&vault_module=spark&vault=0xdead');
    expect(router.state.location.pathname).toBe(ROUTES.EARN);
    expect(router.state.location.search).toEqual({ product: 'vault' });
  });

  // The path generations between the query-param app and this one never
  // reached production, so they are deliberately unsupported: no link in the
  // wild points at them, and carrying them would mean a two-hop redirect.
  it.each([
    ['/savings'],
    ['/rewards'],
    ['/vaults'],
    ['/fixed'],
    ['/expert'],
    ['/expert/stusds'],
    ['/earn/expert'],
    ['/convert/psm'],
    ['/convert/trade']
  ])('leaves the never-shipped path %s at the 404 screen', async from => {
    const router = await routerAt(from);
    expect(isNotFound(router)).toBe(true);
  });
});

describe('fixed (Pendle) market detail routes', () => {
  const market = PENDLE_MARKETS[0];

  it('boots /earn/fixed/:slug for a live market', async () => {
    const router = await routerAt(`${ROUTES.EARN_FIXED}/${market.slug}`);
    const match = router.state.matches.find(m => (m.routeId as string) === '/_shell/earn/fixed/$slug');
    expect(match).toBeDefined();
  });

  it('falls back to the Earn marketplace, filtered to fixed, for an unknown slug', async () => {
    const router = await routerAt(`${ROUTES.EARN_FIXED}/pt-does-not-exist`);
    expect(router.state.location.pathname).toBe(ROUTES.EARN);
    expect(router.state.location.search).toEqual({ product: 'fixed' });
  });

  it('keeps a matured market on its detail page — the claim card lives there now', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date((market.expiry + 60) * 1000));
    try {
      const router = await routerAt(`${ROUTES.EARN_FIXED}/${market.slug}`);
      expect(router.state.location.pathname).toBe(`${ROUTES.EARN_FIXED}/${market.slug}`);
    } finally {
      vi.useRealTimers();
    }
  });

  it('redirects the legacy market/:address path to the slug route, preserving search', async () => {
    const router = await routerAt(`${ROUTES.EARN_FIXED}/market/${market.marketAddress}?network=ethereum`);
    expect(router.state.location.pathname).toBe(`${ROUTES.EARN_FIXED}/${market.slug}`);
    expect(router.state.location.search).toEqual({ network: 'ethereum' });
  });
});

describe('vault detail routes', () => {
  const vault = MORPHO_VAULTS[0];
  const vaultAddress = Object.values(vault.vaultAddress)[0]!;

  it('boots /earn/vaults/morpho/:address for a known vault', async () => {
    const router = await routerAt(`${ROUTES.EARN_VAULTS}/morpho/${vaultAddress}`);
    const match = router.state.matches.find(
      m => (m.routeId as string) === '/_shell/earn/vaults/$provider/$vaultAddress'
    );
    expect(match).toBeDefined();
  });

  it.each([
    ['an unknown vault address', `${ROUTES.EARN_VAULTS}/morpho/0x000000000000000000000000000000000000dEaD`],
    ['an unrecognised provider segment', `${ROUTES.EARN_VAULTS}/bogus/${vaultAddress}`]
  ])('falls back to the Earn marketplace, filtered to vaults, for %s', async (_case, path) => {
    const router = await routerAt(path);
    expect(router.state.location.pathname).toBe(ROUTES.EARN);
    expect(router.state.location.search).toEqual({ product: 'vault' });
  });
});

// G5: the shell used to swap a geo-restricted module's panes for the Balances
// pair, but only on the boxed branch — once every route went full-width that
// swap was unreachable and a deep link rendered the restricted module in full.
// The gate now lives in the router.
describe('geo-restricted module routes', () => {
  const market = PENDLE_MARKETS[0];
  const vaultAddress = Object.values(MORPHO_VAULTS[0].vaultAddress)[0]!;

  const guarded: [ModuleId, string][] = [
    ['savings', ROUTES.EARN_SAVINGS],
    ['expert', ROUTES.EARN_STUSDS],
    ['rewards', `${ROUTES.EARN_REWARDS}/0x0650CAF159C5A49f711e8169D4336ECB9b950275`],
    ['stake', '/stake'],
    ['fixed', `${ROUTES.EARN_FIXED}/${market.slug}`],
    ['vaults', `${ROUTES.EARN_VAULTS}/morpho/${vaultAddress}`]
  ];

  it.each(guarded)('redirects %s to the Portfolio when the module is restricted', async (module, path) => {
    seedGeoConfig([module]);
    const router = await routerAt(path);
    expect(router.state.location.pathname).toBe(ROUTES.PORTFOLIO);
  });

  it.each(guarded)('serves %s when the module is enabled', async (_module, path) => {
    const router = await routerAt(path);
    expect(router.state.location.pathname).not.toBe(ROUTES.PORTFOLIO);
  });

  it('preserves search params through a geo redirect', async () => {
    seedGeoConfig(['savings']);
    const router = await routerAt(`${ROUTES.EARN_SAVINGS}?network=ethereum`);
    expect(router.state.location.pathname).toBe(ROUTES.PORTFOLIO);
    expect(router.state.location.search).toEqual({ network: 'ethereum' });
  });

  // Path validity resolves before the geo gate, so a bogus entity still lands on
  // the marketplace rather than implying it exists but is restricted.
  it('prefers the unknown-vault fallback over the geo redirect', async () => {
    seedGeoConfig(['vaults']);
    const router = await routerAt(`${ROUTES.EARN_VAULTS}/morpho/0x000000000000000000000000000000000000dEaD`);
    expect(router.state.location.pathname).toBe(ROUTES.EARN);
  });

  it('prefers the unknown-slug fallback over the geo redirect', async () => {
    seedGeoConfig(['fixed']);
    const router = await routerAt(`${ROUTES.EARN_FIXED}/pt-does-not-exist`);
    expect(router.state.location.pathname).toBe(ROUTES.EARN);
  });
});

describe('unmatched paths', () => {
  // Regression: with the default fuzzy not-found mode, /earn/bogus rendered the
  // full-page NotFound (own chrome included) nested inside the app shell.
  it('resolves an unknown child of an existing route at the root, outside the shell', async () => {
    const router = await routerAt('/earn/bogus');
    expect(matchedRouteIds(router).some(id => id.startsWith('/_shell'))).toBe(false);
  });

  it('resolves an unknown top-level path at the root', async () => {
    const router = await routerAt('/bogus');
    expect(matchedRouteIds(router).some(id => id.startsWith('/_shell'))).toBe(false);
  });
});
