import { renderHook, cleanup, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Intent } from '@/lib/enums';
import { NetworkSwitchProvider, useNetworkSwitch } from '@/modules/ui/context/NetworkSwitchContext';
import { useNetworkChangeToast } from './useNetworkChangeToast';

const h = vi.hoisted(() => ({
  chainId: 8453,
  isConnected: true,
  showNetworkToast: vi.fn()
}));

vi.mock('wagmi', () => ({
  useChainId: () => h.chainId,
  useChains: () => [
    { id: 1, name: 'Ethereum' },
    { id: 8453, name: 'Base' }
  ],
  useAccount: () => ({ isConnected: h.isConnected }),
  // The provider under test also hosts the shared switch function.
  useConnection: () => ({ connector: undefined }),
  useSwitchChain: () => ({ switchChain: vi.fn(), isPending: false, variables: undefined })
}));
vi.mock('@/modules/analytics/hooks/useAppAnalytics', () => ({
  useAppAnalytics: () => ({ trackNetworkSwitchRequested: vi.fn(), trackNetworkSwitchCompleted: vi.fn() })
}));

vi.mock('./useEnhancedNetworkToast', () => ({
  useEnhancedNetworkToast: () => ({ showNetworkToast: h.showNetworkToast })
}));

/** The shell hook plus the context handles a flow (route or in-place action) uses. */
function useHarness(intent: Intent) {
  useNetworkChangeToast(intent);
  return useNetworkSwitch();
}

const renderToastHook = (intent: Intent) =>
  renderHook(({ intent }: { intent: Intent }) => useHarness(intent), {
    initialProps: { intent },
    wrapper: NetworkSwitchProvider
  });

describe('useNetworkChangeToast', () => {
  beforeEach(() => {
    h.chainId = 8453;
    h.isConnected = true;
    h.showNetworkToast.mockClear();
  });
  afterEach(() => cleanup());

  it('explains the change with the recorded causing module, not the current route', () => {
    // An in-place action on Portfolio (route intent BALANCES) switches the
    // chain for Fixed Yield: the toast must read the recorded reason.
    const { result, rerender } = renderToastHook(Intent.BALANCES_INTENT);
    act(() => {
      result.current.setAutoSwitchIntent(Intent.FIXED_INTENT);
      result.current.setIsAutoSwitching(true);
    });

    h.chainId = 1;
    rerender({ intent: Intent.BALANCES_INTENT });

    expect(h.showNetworkToast).toHaveBeenCalledTimes(1);
    expect(h.showNetworkToast.mock.calls[0][0]).toMatchObject({
      currentIntent: Intent.FIXED_INTENT,
      isAutoSwitch: true,
      previousChain: { id: 8453, name: 'Base' },
      currentChain: { id: 1, name: 'Ethereum' }
    });
    // Consumed: the next chain change must not reuse a stale reason.
    expect(result.current.autoSwitchIntent).toBeNull();
  });

  it('drops a recorded reason when the wallet disconnects mid-switch', () => {
    const { result, rerender } = renderToastHook(Intent.BALANCES_INTENT);
    act(() => {
      result.current.setAutoSwitchIntent(Intent.FIXED_INTENT);
      result.current.setIsAutoSwitching(true);
      result.current.setIsSwitchingNetwork(true);
    });

    h.isConnected = false;
    rerender({ intent: Intent.BALANCES_INTENT });

    expect(result.current.autoSwitchIntent).toBeNull();
    expect(h.showNetworkToast).not.toHaveBeenCalled();
  });

  it('falls back to the route intent when no causing module was recorded', () => {
    const { result, rerender } = renderToastHook(Intent.STAKE_INTENT);
    act(() => {
      result.current.setIsAutoSwitching(true);
    });

    h.chainId = 1;
    rerender({ intent: Intent.STAKE_INTENT });

    expect(h.showNetworkToast).toHaveBeenCalledTimes(1);
    expect(h.showNetworkToast.mock.calls[0][0]).toMatchObject({
      currentIntent: Intent.STAKE_INTENT,
      isAutoSwitch: true
    });
  });

  it('stays quiet when the wallet lands where an in-app control asked it to', () => {
    // A product page's network dropdown (or the modal's switch) records its
    // target; that landing is the user's own change, so no toast — and the
    // request is spent, so the next change is announced again.
    const { result, rerender } = renderToastHook(Intent.SAVINGS_INTENT);
    act(() => {
      result.current.setPendingManualSwitchChainId(1);
    });

    h.chainId = 1;
    rerender({ intent: Intent.SAVINGS_INTENT });

    expect(h.showNetworkToast).not.toHaveBeenCalled();
    expect(result.current.pendingManualSwitchChainId).toBeNull();

    h.chainId = 8453;
    rerender({ intent: Intent.SAVINGS_INTENT });
    expect(h.showNetworkToast).toHaveBeenCalledTimes(1);
    expect(h.showNetworkToast.mock.calls[0][0]).toMatchObject({ isAutoSwitch: false });
  });

  it('still announces a wallet-side change that lands elsewhere than the pending request', () => {
    const { result, rerender } = renderToastHook(Intent.SAVINGS_INTENT);
    act(() => {
      result.current.setPendingManualSwitchChainId(10);
    });

    h.chainId = 1;
    rerender({ intent: Intent.SAVINGS_INTENT });

    expect(h.showNetworkToast).toHaveBeenCalledTimes(1);
    expect(result.current.pendingManualSwitchChainId).toBeNull();
  });
});
