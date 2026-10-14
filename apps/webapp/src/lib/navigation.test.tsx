import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider
} from '@tanstack/react-router';
import { useAppSearchParams } from './navigation';

/**
 * A real router on a memory history: the hook reads the committed route
 * match, and only a router can stage the gap between a location update and
 * the outlet swap that the hook exists to bridge (APP-562).
 */
function Probe({ id }: { id: string }) {
  const [searchParams] = useAppSearchParams();
  return <div data-testid={id}>{searchParams.toString()}</div>;
}

function Setter({ id }: { id: string }) {
  const [, setSearchParams] = useAppSearchParams();
  return (
    <button
      data-testid={id}
      onClick={() =>
        setSearchParams(
          params => {
            params.set('tab', 'about');
            return params;
          },
          { replace: true }
        )
      }
    />
  );
}

type Deferred = { promise: Promise<void>; resolve: () => void };
const deferred = (): Deferred => {
  let resolve!: () => void;
  const promise = new Promise<void>(r => (resolve = r));
  return { promise, resolve };
};

async function renderRouter(initialPath: string, bLoad?: Deferred) {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <Probe id="root" />
        <Outlet />
      </>
    )
  });
  const aRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/a',
    component: () => (
      <>
        <Probe id="a" />
        <Setter id="set-a" />
      </>
    )
  });
  const bRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/b',
    loader: () => bLoad?.promise,
    component: () => <Probe id="b" />
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([aRoute, bRoute]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
    parseSearch: searchStr => Object.fromEntries(new URLSearchParams(searchStr)),
    stringifySearch: search => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(search)) {
        if (value !== undefined && value !== null) params.set(key, String(value));
      }
      const str = params.toString();
      return str ? `?${str}` : '';
    }
  });
  render(<RouterProvider router={router} />);
  await screen.findByTestId('root');
  return router;
}

afterEach(() => vi.restoreAllMocks());

describe('useAppSearchParams', () => {
  it('reads the search of the committed route, at every depth', async () => {
    await renderRouter('/a?tab=about&flow=manage');
    expect(screen.getByTestId('a').textContent).toBe('tab=about&flow=manage');
    expect(screen.getByTestId('root').textContent).toBe('tab=about&flow=manage');
  });

  it('keeps the outgoing page on its own search until the outlet swaps', async () => {
    // The router writes its location when a load STARTS and swaps the matches
    // when it ENDS. Holding /b's loader open pins the app inside that window:
    // the URL already says /b, the outlet still shows /a. A location read
    // would hand /a the empty search here — the frame a view transition
    // snapshots as the outgoing page.
    const bLoad = deferred();
    const router = await renderRouter('/a?tab=about', bLoad);

    let settled: Promise<unknown>;
    act(() => {
      settled = router.navigate({ to: '/b' as '/' });
    });
    await waitFor(() => expect(router.state.location.pathname).toBe('/b'));
    expect(router.state.location.searchStr).toBe('');

    expect(screen.getByTestId('a').textContent).toBe('tab=about');
    expect(screen.getByTestId('root').textContent).toBe('tab=about');
    expect(screen.queryByTestId('b')).toBeNull();

    await act(async () => {
      bLoad.resolve();
      await settled;
    });
    expect(screen.queryByTestId('a')).toBeNull();
    expect(screen.getByTestId('b').textContent).toBe('');
    expect(screen.getByTestId('root').textContent).toBe('');
  });

  it('follows a same-route search write', async () => {
    const router = await renderRouter('/a');
    await act(async () => {
      screen.getByTestId('set-a').click();
    });
    await waitFor(() => expect(screen.getByTestId('a').textContent).toBe('tab=about'));
    expect(router.state.location.searchStr).toBe('?tab=about');
    expect(router.state.location.pathname).toBe('/a');
  });

  it('does not navigate when the write leaves the URL as it is', async () => {
    const router = await renderRouter('/a?tab=about');
    const navigate = vi.spyOn(router, 'navigate');
    await act(async () => {
      screen.getByTestId('set-a').click();
    });
    expect(navigate).not.toHaveBeenCalled();
  });
});
