import { describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, type AnyRouter } from '@tanstack/react-router';
import { createAppRouter } from '@/pages/router';
import { Intent } from '@/lib/enums';
import { ROUTES } from '@/lib/routes';
import { PENDLE_MARKETS } from '@/hooks/pendle/constants';

// Boots the app's real router (route tree + redirects + not-found config)
// against a path without rendering, so a missing destination route or broken
// redirect fails here instead of 404ing on a preview deploy.
async function routerAt(path: string): Promise<AnyRouter> {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
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
    [ROUTES.EARN_REWARDS, '/_shell/earn/rewards'],
    [ROUTES.EARN_VAULTS, '/_shell/earn/vaults'],
    [ROUTES.EARN_FIXED, '/_shell/earn/fixed'],
    [ROUTES.EARN_EXPERT, '/_shell/earn/expert']
  ])('boots the %s module under the Earn destination', async (path, routeId) => {
    expect(matchedRouteIds(await routerAt(path))).toContain(routeId);
  });

  it('declares the Balances intent on /portfolio for shell orchestration', async () => {
    const router = await routerAt(ROUTES.PORTFOLIO);
    const match = router.state.matches.find(m => (m.routeId as string) === '/_shell/portfolio');
    expect(match?.staticData?.intent).toBe(Intent.BALANCES_INTENT);
  });

  it.each([
    [ROUTES.PORTFOLIO, '/_shell/portfolio'],
    [ROUTES.EARN, '/_shell/earn/']
  ])('declares %s full-width so it escapes the widget-pane column', async (path, routeId) => {
    const router = await routerAt(path);
    const match = router.state.matches.find(m => (m.routeId as string) === routeId);
    expect(match?.staticData?.fullWidth).toBe(true);
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
    ['/rewards', ROUTES.EARN_REWARDS],
    ['/vaults', ROUTES.EARN_VAULTS],
    ['/fixed', ROUTES.EARN_FIXED],
    ['/expert', ROUTES.EARN_EXPERT],
    ['/expert/stusds', `${ROUTES.EARN_EXPERT}/stusds`]
  ])('redirects %s to %s', async (from, to) => {
    const router = await routerAt(from);
    expect(router.state.location.pathname).toBe(to);
  });

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

  it('boots /earn/fixed/:slug full-width for a live market', async () => {
    const router = await routerAt(`${ROUTES.EARN_FIXED}/${market.slug}`);
    const match = router.state.matches.find(m => (m.routeId as string) === '/_shell/earn/fixed/$slug');
    expect(match).toBeDefined();
    expect(match?.staticData?.fullWidth).toBe(true);
  });

  it('falls back to the fixed overview for an unknown slug', async () => {
    const router = await routerAt(`${ROUTES.EARN_FIXED}/pt-does-not-exist`);
    expect(router.state.location.pathname).toBe(ROUTES.EARN_FIXED);
  });

  it('redirects a matured market detail to the fixed overview', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date((market.expiry + 60) * 1000));
    try {
      const router = await routerAt(`${ROUTES.EARN_FIXED}/${market.slug}`);
      expect(router.state.location.pathname).toBe(ROUTES.EARN_FIXED);
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
