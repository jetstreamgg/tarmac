/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chainId, forkChainId } from '@/utils/chainId';
import { useBridgeForm } from './useBridgeForm';

const FORK_L2S = [forkChainId.base, forkChainId.arbitrum, forkChainId.optimism, forkChainId.unichain];

const mocks = vi.hoisted(() => ({ appChainId: 314310, switched: [] as number[] }));

vi.mock('@/data/wagmi/config/forkChains', () => ({
  forkL2Chains: [],
  forkL2ChainIds: [9998453, 99942161, 99910, 999130]
}));
vi.mock('wagmi', () => ({
  useConnection: () => ({ isConnected: true, address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F' }),
  // The dev config: the real chains plus the Tenderly forks.
  useChains: () => [1, 314310, 8453, 42161, 10, 130, 9998453, 99942161, 99910, 999130].map(id => ({ id })),
  useReadContract: () => ({ status: 'success', data: 1n })
}));
vi.mock('@/hooks', async io => ({
  ...(await io<typeof import('@/hooks')>()),
  useAppChainId: () => mocks.appChainId,
  useSafeWalletStatus: () => 'not-safe',
  useTokenBalance: () => ({ data: { value: 10n ** 18n }, isLoading: false, refetch: () => {} })
}));
vi.mock('@/modules/ui/context/NetworkSwitchContext', () => ({
  useNetworkSwitch: () => ({
    canSwitchChain: true,
    handleSwitchChain: ({ chainId }: { chainId: number }) => mocks.switched.push(chainId)
  })
}));
vi.mock('./useSafeConfig', () => ({ useSafeConfig: () => ({ lookup: undefined, isChecking: false }) }));
vi.mock('./useCctpGate', () => ({ useCctpGate: () => undefined }));
vi.mock('./useAddressCode', () => ({ useAddressCode: () => ({ code: 'none', isChecking: false }) }));

const REAL_IDS = [chainId.mainnet, chainId.base, chainId.arbitrum, chainId.optimism, chainId.unichain];

describe('useBridgeForm on the Tenderly multichain fork: moving the source stays on the forks', () => {
  beforeEach(() => {
    Object.assign(mocks, { appChainId: chainId.tenderly, switched: [] });
  });

  it('flip from the Ethereum fork asks for the fork Base', () => {
    const { result } = renderHook(() => useBridgeForm());
    expect(result.current.to).toBe('base');
    act(() => result.current.flip());
    expect(mocks.switched).toEqual([forkChainId.base]);
  });

  it('picking an L2 source from the Ethereum fork asks for its fork L2', () => {
    const { result } = renderHook(() => useBridgeForm());
    act(() => result.current.selectFrom('arbitrum'));
    expect(mocks.switched).toEqual([forkChainId.arbitrum]);
  });

  it('picking Ethereum from a fork L2 asks for the Ethereum fork', () => {
    mocks.appChainId = forkChainId.optimism;
    const { result } = renderHook(() => useBridgeForm());
    expect(result.current.from).toBe('optimism');
    act(() => result.current.selectFrom('ethereum'));
    expect(mocks.switched).toEqual([chainId.tenderly]);
  });

  it('never asks the wallet for a production chain', () => {
    for (const start of [chainId.tenderly, ...FORK_L2S]) {
      mocks.appChainId = start;
      const { result, unmount } = renderHook(() => useBridgeForm());
      act(() => result.current.flip());
      unmount();
    }
    expect(mocks.switched.length).toBeGreaterThan(0);
    expect(mocks.switched.filter(id => REAL_IDS.includes(id))).toEqual([]);
  });
});
