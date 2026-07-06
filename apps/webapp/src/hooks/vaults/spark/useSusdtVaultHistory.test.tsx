/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { ModuleEnum, TransactionTypeEnum } from '../../constants';

// Reconstruct the interpolated query string so assertions can inspect it.
vi.mock('graphql-request', () => ({
  request: vi.fn(),
  gql: (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((acc, str, i) => acc + str + (i < values.length ? String(values[i]) : ''), '')
}));

vi.mock('wagmi', () => ({
  useConnection: vi.fn(),
  useChainId: vi.fn()
}));

import { request } from 'graphql-request';
import { useConnection, useChainId } from 'wagmi';
import { useSusdtVaultHistory } from './useSusdtVaultHistory';

const USER = '0x1111111111111111111111111111111111111111';

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useSusdtVaultHistory — Sky Ecosystem subgraph (sUSDT)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useConnection).mockReturnValue({ address: USER } as unknown as ReturnType<
      typeof useConnection
    >);
    // Mainnet, non-testnet → chainId filter resolves to 1.
    vi.mocked(useChainId).mockReturnValue(1);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes deposits as positive SUPPLY and withdrawals as negative WITHDRAW, in USDT', async () => {
    vi.mocked(request).mockResolvedValueOnce({
      susdtDeposits: [{ assets: '1000000', blockTimestamp: '1700000000', transactionHash: '0xdeposit' }],
      susdtWithdraws: [{ assets: '400000', blockTimestamp: '1700000100', transactionHash: '0xwithdraw' }]
    });

    const { result } = renderHook(() => useSusdtVaultHistory(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toHaveLength(2);

    const deposit = result.current.data!.find(h => h.transactionHash === '0xdeposit')!;
    expect(deposit.type).toBe(TransactionTypeEnum.SUPPLY);
    expect(deposit.module).toBe(ModuleEnum.SUSDT);
    expect(deposit.assets).toBe(1000000n);
    expect(deposit.token.symbol).toBe('USDT');
    expect(deposit.token.decimals).toBe(6);

    const withdraw = result.current.data!.find(h => h.transactionHash === '0xwithdraw')!;
    expect(withdraw.type).toBe(TransactionTypeEnum.WITHDRAW);
    expect(withdraw.assets).toBe(-400000n); // withdrawals are negative
  });

  it('sorts results descending by timestamp', async () => {
    vi.mocked(request).mockResolvedValueOnce({
      susdtDeposits: [{ assets: '1', blockTimestamp: '1700000000', transactionHash: '0xold' }],
      susdtWithdraws: [{ assets: '1', blockTimestamp: '1700009999', transactionHash: '0xnew' }]
    });

    const { result } = renderHook(() => useSusdtVaultHistory(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.data).toHaveLength(2));
    expect(result.current.data![0].transactionHash).toBe('0xnew');
    expect(result.current.data![1].transactionHash).toBe('0xold');
  });

  it('queries SusdtDeposit/SusdtWithdraw filtered by owner + chainId', async () => {
    vi.mocked(request).mockResolvedValueOnce({ susdtDeposits: [], susdtWithdraws: [] });

    renderHook(() => useSusdtVaultHistory(), { wrapper: makeWrapper() });

    await waitFor(() => expect(request).toHaveBeenCalled());
    const [, query] = (request as Mock).mock.calls[0];
    expect(query).toContain('SusdtDeposit');
    expect(query).toContain('SusdtWithdraw');
    expect(query).toContain(`owner: { _ilike: "${USER}" }`);
    expect(query).toContain('chainId: { _eq: 1 }');
  });

  it('does not hit the subgraph when no wallet is connected', async () => {
    vi.mocked(useConnection).mockReturnValue({ address: undefined } as unknown as ReturnType<
      typeof useConnection
    >);

    const { result } = renderHook(() => useSusdtVaultHistory(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.data).toEqual([]));
    expect(request).not.toHaveBeenCalled();
  });

  it('surfaces an error when the subgraph request fails', async () => {
    vi.mocked(request).mockRejectedValueOnce(new Error('subgraph down'));

    const { result } = renderHook(() => useSusdtVaultHistory(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.data).toBeUndefined();
  });
});
