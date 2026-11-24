/**
 * @vitest-environment happy-dom
 */
import { createElement, type ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseEther } from 'viem';
import { chainId, forkChainId } from '@/utils/chainId';
import { useNativeDepositLegs } from './useNativeDepositLegs';

const mocks = vi.hoisted(() => ({ clientChains: [] as (number | undefined)[] }));

vi.mock('@/data/wagmi/config/forkChains', () => ({ forkL2Chains: [], forkL2ChainIds: [99942161] }));
vi.mock('wagmi', async io => ({
  ...(await io<typeof import('wagmi')>()),
  usePublicClient: ({ chainId }: { chainId?: number }) => {
    mocks.clientChains.push(chainId);
    return undefined;
  }
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

const render = (l1: number) =>
  renderHook(
    () =>
      useNativeDepositLegs({
        enabled: true,
        to: 'arbitrum',
        chainId: l1,
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

describe('useNativeDepositLegs on the Tenderly multichain fork', () => {
  beforeEach(() => {
    mocks.clientChains = [];
  });

  it('prices the Arbitrum ticket on the fork Arbitrum when sent from the Ethereum fork', () => {
    render(chainId.tenderly);
    expect(mocks.clientChains).toContain(forkChainId.arbitrum);
    expect(mocks.clientChains).not.toContain(chainId.arbitrum);
  });

  it('prices it on Arbitrum One when sent from mainnet', () => {
    render(chainId.mainnet);
    expect(mocks.clientChains).toContain(chainId.arbitrum);
    expect(mocks.clientChains).not.toContain(forkChainId.arbitrum);
  });
});
