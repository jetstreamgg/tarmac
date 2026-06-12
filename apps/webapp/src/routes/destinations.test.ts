import { describe, expect, it } from 'vitest';
import { createMemoryHistory, createRouter } from '@tanstack/react-router';
import { routeTree } from '@/routeTree.gen';
import { Intent } from '@/lib/enums';
import { ROUTES } from '@/lib/routes';

// Resolves a path against the real route tree without rendering, so a missing
// destination route fails here instead of 404ing on a preview deploy.
async function matchedRouteIds(path: string): Promise<string[]> {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] })
  });
  await router.load();
  return router.state.matches.map(match => match.routeId as string);
}

describe('target-IA destination routes', () => {
  it('boots /portfolio as a shell route', async () => {
    expect(await matchedRouteIds(ROUTES.PORTFOLIO)).toContain('/_shell/portfolio');
  });

  it('boots /earn as a shell route', async () => {
    expect(await matchedRouteIds(ROUTES.EARN)).toContain('/_shell/earn');
  });

  it('declares the Balances intent on /portfolio for shell orchestration', async () => {
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: [ROUTES.PORTFOLIO] })
    });
    await router.load();
    const match = router.state.matches.find(m => (m.routeId as string) === '/_shell/portfolio');
    expect(match?.staticData?.intent).toBe(Intent.BALANCES_INTENT);
  });
});
