import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEnhancedNetworkToast } from './useEnhancedNetworkToast';

const h = vi.hoisted(() => ({
  toastWithClose: vi.fn()
}));

vi.mock('wagmi', () => ({ useChains: () => [] }));
vi.mock('@/components/ui/use-toast', () => ({
  toast: { dismiss: vi.fn() },
  toastWithClose: h.toastWithClose
}));
vi.mock('@/modules/layout/components/Typography', () => ({
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>
}));
vi.mock(import('@/utils'), async importOriginal => ({
  ...(await importOriginal()),
  getChainIcon: () => <span />,
  isL2ChainId: () => false
}));
vi.mock('@/modules/icons', () => ({ ArrowRightLong: () => null }));
vi.mock('@/lib/widget-network-map', () => ({
  isMultichain: () => false,
  requiresMainnet: () => false
}));
vi.mock('@/modules/ui/context/ChainModalContext', () => ({
  useChainModalContext: () => ({ handleSwitchChain: vi.fn() })
}));
vi.mock('@/lib/navigation', () => ({
  useAppSearchParams: () => [new URLSearchParams(), vi.fn()]
}));
vi.mock('@/data/wagmi/config/config.default', () => ({ getSupportedChainIds: () => [] }));

const COVER_FLAG = 'data-app-loader-cover';

// MutationObserver callbacks are delivered as microtasks, outside the fake
// timer clock — flush a couple of ticks so a just-cleared cover flag reaches
// any parked observer.
const flushObservers = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

// Same-intent changes debounce for 700ms before the show is attempted.
const elapseDebounce = () => act(() => vi.advanceTimersByTime(700));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  // cleanup() unmounts first, so pending observers are disconnected before
  // the flag is cleared — nothing leaks a show into the next test.
  cleanup();
  document.documentElement.removeAttribute(COVER_FLAG);
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('useEnhancedNetworkToast', () => {
  it('shows immediately when no cover is up', () => {
    const { result } = renderHook(() => useEnhancedNetworkToast());
    act(() => result.current.showNetworkToast({ currentChain: { id: 1, name: 'Ethereum' } }));
    elapseDebounce();
    expect(h.toastWithClose).toHaveBeenCalledTimes(1);
  });

  it('a toast fired under the cover waits and shows at reveal', async () => {
    document.documentElement.setAttribute(COVER_FLAG, '');
    const { result } = renderHook(() => useEnhancedNetworkToast());
    act(() => result.current.showNetworkToast({ currentChain: { id: 1, name: 'Ethereum' } }));
    elapseDebounce();
    expect(h.toastWithClose).not.toHaveBeenCalled();

    document.documentElement.removeAttribute(COVER_FLAG);
    await flushObservers();
    expect(h.toastWithClose).toHaveBeenCalledTimes(1);
  });

  it('a second network change under the cover supersedes the queued toast', async () => {
    // Regression: each deferred show parked its own observer, so every change
    // under the cover stacked another toast at reveal — including stale
    // "Switched to X" entries for networks the user had already left.
    document.documentElement.setAttribute(COVER_FLAG, '');
    const { result } = renderHook(() => useEnhancedNetworkToast());
    act(() => result.current.showNetworkToast({ currentChain: { id: 1, name: 'Ethereum' } }));
    elapseDebounce();
    act(() => result.current.showNetworkToast({ currentChain: { id: 8453, name: 'Base' } }));
    elapseDebounce();

    document.documentElement.removeAttribute(COVER_FLAG);
    await flushObservers();

    expect(h.toastWithClose).toHaveBeenCalledTimes(1);
    const content = h.toastWithClose.mock.calls[0][0];
    expect(content.props.children[0].props.children).toBe('Switched to Base');
  });

  it('unmount cancels a deferred toast instead of leaking the observer', async () => {
    document.documentElement.setAttribute(COVER_FLAG, '');
    const { result, unmount } = renderHook(() => useEnhancedNetworkToast());
    act(() => result.current.showNetworkToast({ currentChain: { id: 1, name: 'Ethereum' } }));
    elapseDebounce();
    unmount();

    document.documentElement.removeAttribute(COVER_FLAG);
    await flushObservers();
    expect(h.toastWithClose).not.toHaveBeenCalled();
  });
});
