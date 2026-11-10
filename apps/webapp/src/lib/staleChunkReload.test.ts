import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  type AnyRouter
} from '@tanstack/react-router';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installStaleChunkReload, reloadIfChunkError } from './staleChunkReload';

const T0 = new Date('2026-09-16T12:00:00Z');
const GUARD_KEY = 'staleChunkReloadedAt';

const firePreloadError = (payload = new Error('Failed to fetch dynamically imported module')) => {
  const event = Object.assign(new Event('vite:preloadError', { cancelable: true }), { payload });
  window.dispatchEvent(event);
  return event;
};

describe('installStaleChunkReload', () => {
  let replace: ReturnType<typeof vi.spyOn>;
  let reload: ReturnType<typeof vi.spyOn>;
  let router: AnyRouter;
  let releaseSlowRoute: () => void;
  let cleanups: Array<() => void>;

  const makeRouter = (): AnyRouter => {
    const slowRouteGate = new Promise<void>(resolve => {
      releaseSlowRoute = resolve;
    });
    const rootRoute = createRootRoute();
    const route = (path: string, loader?: () => Promise<void>) =>
      createRoute({ getParentRoute: () => rootRoute, path, loader });
    const appRouter = createRouter({
      routeTree: rootRoute.addChildren([
        route('/'),
        route('/earn'),
        route('/slow', () => slowRouteGate),
        createRoute({
          getParentRoute: () => rootRoute,
          path: '/filters',
          loaderDeps: ({ search }: { search: Record<string, unknown> }) => search,
          loader: ({ deps }) => (deps.slow ? slowRouteGate : undefined)
        })
      ]),
      history: createMemoryHistory({ initialEntries: ['/'] })
    }) as unknown as AnyRouter;
    // RouterProvider's Transitioner does this in the app.
    cleanups.push(appRouter.history.subscribe(() => void appRouter.load()));
    return appRouter;
  };

  const install = (target: AnyRouter = router) => {
    cleanups.push(installStaleChunkReload(target));
  };

  const go = (to: string, search?: Record<string, string>) => router.navigate({ to, search });

  beforeEach(async () => {
    sessionStorage.clear();
    cleanups = [];
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(T0);
    replace = vi.spyOn(window.location, 'replace').mockImplementation(() => {});
    reload = vi.spyOn(window.location, 'reload').mockImplementation(() => {});
    router = makeRouter();
    await router.load();
  });

  afterEach(() => {
    releaseSlowRoute();
    cleanups.forEach(cleanup => cleanup());
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  afterAll(() => {
    sessionStorage.clear();
  });

  it('leaves the page alone when no navigation is under way (hover preload)', () => {
    install();

    const event = firePreloadError();

    expect(replace).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    expect(sessionStorage.getItem(GUARD_KEY)).toBeNull();
  });

  it('full-loads the destination on the next page navigation of a stale tab', async () => {
    install();
    firePreloadError();

    await go('/earn', { tab: 'vaults' });

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/earn?tab=vaults');
    expect(reload).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(GUARD_KEY)).toBe(String(T0.getTime()));
  });

  it('does not full-load a tab that never failed to load a chunk', async () => {
    install();

    await go('/earn');

    expect(replace).not.toHaveBeenCalled();
  });

  it('keeps search-param updates in place, and still full-loads the next page change', async () => {
    install();
    firePreloadError();

    await go('/', { network: 'base' });
    expect(replace).not.toHaveBeenCalled();

    await go('/earn');
    expect(replace).toHaveBeenCalledWith('/earn');
  });

  it('full-loads the destination when a chunk fails during a page navigation', async () => {
    install();

    void go('/slow');
    await vi.waitFor(() => expect(router.latestLocation.pathname).toBe('/slow'));
    firePreloadError();

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/slow');
  });

  it('full-loads the destination when a chunk fails during a search-param update', async () => {
    await go('/filters');
    install();

    void go('/filters', { slow: 'yes' });
    await vi.waitFor(() => expect(router.latestLocation.search).toEqual({ slow: 'yes' }));
    firePreloadError();

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/filters?slow=yes');
  });

  it('leaves the page alone on a hover preload at a URL with search params', async () => {
    await go('/', { network: 'base' });
    install();

    firePreloadError();

    expect(replace).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('full-loads the current URL when a chunk fails during the first load', () => {
    const coldRouter = makeRouter();
    install(coldRouter);

    firePreloadError();

    expect(replace).toHaveBeenCalledWith('/');
  });

  it('does not full-load twice inside the window', async () => {
    install();
    firePreloadError();

    await go('/earn');
    vi.advanceTimersByTime(30_000);
    await go('/');

    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('full-loads again once the window has passed', async () => {
    install();
    firePreloadError();

    await go('/earn');
    vi.advanceTimersByTime(61_000);
    await go('/');

    expect(replace).toHaveBeenCalledTimes(2);
  });

  it('honours a full load recorded before this page load', async () => {
    sessionStorage.setItem(GUARD_KEY, String(T0.getTime() - 10_000));
    install();
    firePreloadError();

    await go('/earn');

    expect(replace).not.toHaveBeenCalled();
  });

  it('stays guarded when the clock steps backwards after a full load', async () => {
    install();
    firePreloadError();

    await go('/earn');
    vi.setSystemTime(new Date(T0.getTime() - 30_000));
    await go('/');

    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('reloads in place when an action fails with the chunk error itself', () => {
    const chunkError = new Error('Failed to fetch dynamically imported module');
    install();
    firePreloadError(chunkError);

    reloadIfChunkError(chunkError);

    expect(reload).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(GUARD_KEY)).toBe(String(T0.getTime()));
  });

  it('does not reload a stale tab when an action fails for another reason', () => {
    install();
    firePreloadError();

    reloadIfChunkError(new Error('Request already pending'));

    expect(reload).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(GUARD_KEY)).toBeNull();
  });

  it('does not reload when the failure is not an object', () => {
    install();
    firePreloadError();

    reloadIfChunkError(undefined);

    expect(reload).not.toHaveBeenCalled();
  });

  it('does not reload twice inside the window when the action keeps failing', () => {
    const chunkError = new Error('Failed to fetch dynamically imported module');
    install();
    firePreloadError(chunkError);

    reloadIfChunkError(chunkError);
    vi.advanceTimersByTime(30_000);
    reloadIfChunkError(chunkError);

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('never full-loads when the guard cannot be stored', async () => {
    vi.spyOn(sessionStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    install();
    firePreloadError();

    await go('/earn');

    expect(replace).not.toHaveBeenCalled();
  });
});
