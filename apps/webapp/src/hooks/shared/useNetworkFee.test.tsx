import React from 'react';
import { renderHook, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { erc20Abi, parseAbi, type Call } from 'viem';

// Wallet-less scenario: no account, and no client so no query can fire.
vi.mock('wagmi', () => ({
  useAccount: () => ({ address: undefined }),
  useChainId: () => 1,
  usePublicClient: () => undefined
}));

vi.mock('./useIsBatchSupported', () => ({
  useIsBatchSupported: () => ({ data: false })
}));

vi.mock('../prices/usePrices', () => ({
  usePrices: () => ({ data: undefined, isLoading: false })
}));

import { useNetworkFee } from './useNetworkFee';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

afterEach(cleanup);

describe('useNetworkFee', () => {
  it('survives calls that cannot be encoded yet (wallet-less render, undefined recipient)', () => {
    // The PSM engine hands over its buyGem call with `usr ?? address` while both are
    // undefined — encoding it throws InvalidAddressError. The fee row is read-only:
    // it must fall back to "no estimate", never take the page down (APP-443 item 3).
    const calls: Call[] = [
      {
        to: '0xA188EEC8F81263234dA3622A406892F3D630f98c',
        abi: parseAbi(['function buyGem(address usr, uint256 gemAmt)']),
        functionName: 'buyGem',
        args: [undefined as unknown as `0x${string}`, 100n]
      }
    ];

    const { result } = renderHook(() => useNetworkFee({ calls }), { wrapper });

    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeNull();
  });

  it('still keys encodable calls without touching the network when disabled', () => {
    const calls: Call[] = [
      {
        to: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        abi: erc20Abi,
        functionName: 'approve',
        args: ['0xA188EEC8F81263234dA3622A406892F3D630f98c', 1n]
      }
    ];

    const { result } = renderHook(() => useNetworkFee({ calls, enabled: false }), { wrapper });

    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeNull();
  });
});
