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
  useAccount: () => ({ isConnected: h.isConnected })
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
});
