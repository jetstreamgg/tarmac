/**
 * @vitest-environment happy-dom
 */
import { createElement, type ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { parseEther } from 'viem';
import { chainId } from '@/utils/chainId';
import { useNativeDepositLegs } from './useNativeDepositLegs';

const mocks = vi.hoisted(() => ({ readRetryableEstimates: vi.fn(async () => undefined) }));

// The dev build has the fork Base but no fork Arbitrum.
vi.mock('@/data/wagmi/config/forkChains', () => ({ forkL2Chains: [], forkL2ChainIds: [9998453] }));
vi.mock('wagmi', async io => ({
  ...(await io<typeof import('wagmi')>()),
  // Like wagmi: without a chain id, the active chain's client.
  usePublicClient: ({ chainId }: { chainId?: number }) => ({ chainId: chainId ?? 'active' })
}));
vi.mock('../adapters/nativeDeposit/arbitrumQuote', async io => ({
  ...(await io<typeof import('../adapters/nativeDeposit/arbitrumQuote')>()),
  readRetryableEstimates: mocks.readRetryableEstimates
}));
vi.mock('@/hooks', () => ({
  useTokenAllowance: () => ({ data: undefined, error: null, mutate: vi.fn() })
}));
vi.mock('@/hooks/shared/useSendBatchTransactionFlow', () => ({
  useSendBatchTransactionFlow: () => ({ execute: vi.fn(), reset: vi.fn(), prepared: false, error: null })
}));
vi.mock('@/hooks/shared/useSequentialTransactionFlow', () => ({
  useSequentialTransactionFlow: () => ({ prepared: false, error: null, execute: vi.fn(), reset: vi.fn() })
}));

describe('useNativeDepositLegs on a Tenderly fork without a fork Arbitrum', () => {
  it('never prices the Arbitrum ticket on another chain', async () => {
    renderHook(
      () =>
        useNativeDepositLegs({
          enabled: true,
          to: 'arbitrum',
          chainId: chainId.tenderly,
          account: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
          recipient: undefined,
          amount: parseEther('25'),
          getCallbacks: () => ({ onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: vi.fn() })
        }),
      {
        wrapper: ({ children }: { children: ReactNode }) =>
          createElement(QueryClientProvider, { client: new QueryClient() }, children)
      }
    );
    await new Promise(resolve => setTimeout(resolve, 50));
    await waitFor(() => expect(mocks.readRetryableEstimates).not.toHaveBeenCalled());
  });
});
