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

  it('redirects the bare /earn/rewards index to the Earn marketplace (D6 — no overview screen)', async () => {
    const router = await routerAt(ROUTES.EARN_REWARDS);
    expect(router.state.location.pathname).toBe(ROUTES.EARN);
  });

  it('redirects the bare /earn/fixed index to the Earn marketplace (G6 — no overview screen)', async () => {
    const router = await routerAt(ROUTES.EARN_FIXED);
    expect(router.state.location.pathname).toBe(ROUTES.EARN);
  });

  it('redirects the bare /earn/vaults index to the Earn marketplace (G6 — no overview screen)', async () => {
    const router = await routerAt(ROUTES.EARN_VAULTS);
    expect(router.state.location.pathname).toBe(ROUTES.EARN);
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
  it('redirects "/" to the Portfolio destination', async () => {
    const router = await routerAt('/');
    expect(router.state.location.pathname).toBe(ROUTES.PORTFOLIO);
  });

  it('preserves global search params when redirecting "/" to Portfolio', async () => {
    const router = await routerAt('/?network=base');
    expect(router.state.location.pathname).toBe(ROUTES.PORTFOLIO);
    expect(router.state.location.search).toEqual({ network: 'base' });
  });
});

describe('pre-flip module path redirects', () => {
  it.each([
    ['/savings', ROUTES.EARN_SAVINGS],
    // /rewards, /vaults and /fixed chain through their /earn/* module paths,
    // whose indexes forward to /earn (D6 / G6).
    ['/rewards', ROUTES.EARN],
    ['/vaults', ROUTES.EARN],
    ['/fixed', ROUTES.EARN],
    ['/expert', ROUTES.EARN_STUSDS],
    ['/expert/stusds', ROUTES.EARN_STUSDS]
  ])('redirects %s to %s', async (from, to) => {
    const router = await routerAt(from);
    expect(router.state.location.pathname).toBe(to);
  });

  // The Expert module collapsed into /earn/stusds (D7) — its old /earn URLs
  // (both generations could have been bookmarked) forward there.
  it.each([['/earn/expert'], ['/earn/expert/stusds']])(
    'redirects the retired %s to /earn/stusds',
    async from => {
      const router = await routerAt(from);
      expect(router.state.location.pathname).toBe(ROUTES.EARN_STUSDS);
    }
  );

  it('keeps entity segments in the path and preserves search params', async () => {
    const reward = '0x0650CAF159C5A49f711e8169D4336ECB9b950275';
    const router = await routerAt(`/rewards/${reward}?network=ethereum`);
    expect(router.state.location.pathname).toBe(`${ROUTES.EARN_REWARDS}/${reward}`);
    expect(router.state.location.search).toEqual({ network: 'ethereum' });
  });

  it('translates legacy ?widget= deep links through to the /earn destination', async () => {
    const router = await routerAt('/?widget=savings&network=base');
    expect(router.state.location.pathname).toBe(ROUTES.EARN_SAVINGS);
    expect(router.state.location.search).toEqual({ network: 'base' });
  });
});

describe('fixed (Pendle) market detail routes', () => {
  const market = PENDLE_MARKETS[0];

  it('boots /earn/fixed/:slug for a live market', async () => {
    const router = await routerAt(`${ROUTES.EARN_FIXED}/${market.slug}`);
    const match = router.state.matches.find(m => (m.routeId as string) === '/_shell/earn/fixed/$slug');
    expect(match).toBeDefined();
  });

  it('falls back to the Earn marketplace for an unknown slug', async () => {
    const router = await routerAt(`${ROUTES.EARN_FIXED}/pt-does-not-exist`);
    expect(router.state.location.pathname).toBe(ROUTES.EARN);
  });

  it('redirects a matured market detail to the Portfolio (where redemption lives)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date((market.expiry + 60) * 1000));
    try {
      const router = await routerAt(`${ROUTES.EARN_FIXED}/${market.slug}`);
      expect(router.state.location.pathname).toBe(ROUTES.PORTFOLIO);
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

  it('falls back to the Earn marketplace for an unknown vault address', async () => {
    const router = await routerAt(`${ROUTES.EARN_VAULTS}/morpho/0x000000000000000000000000000000000000dEaD`);
    expect(router.state.location.pathname).toBe(ROUTES.EARN);
  });

  it('falls back to the Earn marketplace for an unrecognised provider segment', async () => {
    const router = await routerAt(`${ROUTES.EARN_VAULTS}/bogus/${vaultAddress}`);
    expect(router.state.location.pathname).toBe(ROUTES.EARN);
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
