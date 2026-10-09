/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBridgeForm } from './useBridgeForm';

const mocks = vi.hoisted(() => ({
  appChainId: 1,
  canSwitchChain: true,
  safeStatus: 'not-safe' as 'safe' | 'not-safe',
  switched: [] as number[]
}));

vi.mock('wagmi', () => ({
  useConnection: () => ({ isConnected: true, address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F' }),
  useChains: () => [1, 8453, 10, 42161, 130].map(id => ({ id }))
}));
vi.mock('@/hooks', async io => ({
  ...(await io<typeof import('@/hooks')>()),
  useAppChainId: () => mocks.appChainId,
  useSafeWalletStatus: () => mocks.safeStatus,
  useTokenBalance: () => ({ data: { value: 10n ** 18n }, isLoading: false })
}));
vi.mock('@/modules/ui/context/NetworkSwitchContext', () => ({
  useNetworkSwitch: () => ({
    canSwitchChain: mocks.canSwitchChain,
    handleSwitchChain: ({ chainId }: { chainId: number }) => mocks.switched.push(chainId)
  })
}));
vi.mock('./useSafeConfig', () => ({ useSafeConfig: () => ({ lookup: undefined, isChecking: false }) }));

describe('useBridgeForm: a source the app cannot switch (Safe) stays on the wallet network', () => {
  beforeEach(() => {
    Object.assign(mocks, { appChainId: 1, canSwitchChain: false, safeStatus: 'safe', switched: [] });
  });

  it('flip keeps the source', () => {
    const { result } = renderHook(() => useBridgeForm());
    expect(result.current.isSourceStatic).toBe(true);
    act(() => result.current.flip());
    expect(result.current.from).toBe('ethereum');
    expect(result.current.sourceUnavailable).toBe(false);
  });

  it('picking the source as destination does not swap it', () => {
    const { result } = renderHook(() => useBridgeForm());
    act(() => result.current.selectTo('ethereum'));
    expect(result.current.from).toBe('ethereum');
  });

  it('picking another source does nothing', () => {
    const { result } = renderHook(() => useBridgeForm());
    act(() => result.current.selectFrom('base'));
    expect(result.current.from).toBe('ethereum');
    expect(result.current.sourceUnavailable).toBe(false);
  });

  it('still lets the destination change', () => {
    const { result } = renderHook(() => useBridgeForm());
    act(() => result.current.selectTo('arbitrum'));
    expect(result.current.to).toBe('arbitrum');
  });
});

describe('useBridgeForm: a destination that moves the source keeps the picked destination', () => {
  beforeEach(() => {
    Object.assign(mocks, { appChainId: 8453, canSwitchChain: true, safeStatus: 'not-safe', switched: [] });
  });

  it('Base to Arbitrum switches to Ethereum and keeps Arbitrum', () => {
    const { result, rerender } = renderHook(() => useBridgeForm());
    expect(result.current.from).toBe('base');
    act(() => result.current.selectTo('arbitrum'));
    expect(mocks.switched).toEqual([1]);
    mocks.appChainId = 1;
    rerender();
    expect(result.current.from).toBe('ethereum');
    expect(result.current.to).toBe('arbitrum');
  });
});
