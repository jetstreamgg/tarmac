/**
 * @vitest-environment happy-dom
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { chainId } from '@/utils/chainId';
import { useBridgeForm } from './useBridgeForm';

vi.mock('@/data/wagmi/config/forkChains', () => ({ forkL2Chains: [], forkL2ChainIds: [] }));
vi.mock('wagmi', () => ({
  useConnection: () => ({ isConnected: true, address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F' }),
  useChains: () => [1, 314310, 8453, 42161, 10, 130].map(id => ({ id })),
  useReadContract: () => ({ status: 'success', data: 1n })
}));
vi.mock('@/hooks', async io => ({
  ...(await io<typeof import('@/hooks')>()),
  useAppChainId: () => chainId.tenderly,
  useSafeWalletStatus: () => 'not-safe',
  useTokenBalance: () => ({ data: { value: 10n ** 18n }, isLoading: false, refetch: () => {} })
}));
vi.mock('@/modules/ui/context/NetworkSwitchContext', () => ({
  useNetworkSwitch: () => ({ canSwitchChain: true, handleSwitchChain: () => {} })
}));
vi.mock('./useSafeConfig', () => ({ useSafeConfig: () => ({ lookup: undefined, isChecking: false }) }));
vi.mock('./useCctpGate', () => ({ useCctpGate: () => undefined }));
vi.mock('./useAddressCode', () => ({ useAddressCode: () => ({ code: 'none', isChecking: false }) }));

describe('useBridgeForm without the Tenderly fork L2s', () => {
  it('offers no fork sources and never reads the pair as the forks, even on the Ethereum fork', () => {
    const { result } = renderHook(() => useBridgeForm());
    expect(result.current.forkSources).toEqual([]);
    expect(result.current.onFork).toBe(false);
  });
});
