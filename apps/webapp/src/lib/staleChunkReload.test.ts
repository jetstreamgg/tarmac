import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  type AnyRouter
} from '@tanstack/react-router';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installStaleChunkReload, reloadStaleTab } from './staleChunkReload';

const T0 = new Date('2026-09-16T12:00:00Z');
const GUARD_KEY = 'staleChunkReloadedAt';

const firePreloadError = () => {
  const event = new Event('vite:preloadError', { cancelable: true });
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
      routeTree: rootRoute.addChildren([route('/'), route('/earn'), route('/slow', () => slowRouteGate)]),
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

  it('reloads in place when a failed action asks a stale tab to recover', () => {
    install();
    firePreloadError();

    reloadStaleTab();

    expect(reload).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(GUARD_KEY)).toBe(String(T0.getTime()));
  });

  it('does not reload a tab that never failed to load a chunk when an action fails', () => {
    install();

    reloadStaleTab();

    expect(reload).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(GUARD_KEY)).toBeNull();
  });

  it('does not reload twice inside the window when the action keeps failing', () => {
    install();
    firePreloadError();

    reloadStaleTab();
    vi.advanceTimersByTime(30_000);
    reloadStaleTab();

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
