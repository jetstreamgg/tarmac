import React from 'react';
import { describe, expect, it, vi, Mock, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDelegates } from './useDelegates';
import { TENDERLY_CHAIN_ID } from '../constants';
import { request } from 'graphql-request';
import { useUserDelegates } from './useUserDelegates';
import { createConfig, WagmiProvider, http } from 'wagmi';
import { mainnet } from 'viem/chains';
import { mock } from 'wagmi/connectors';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';

// Mock the request function from graphql-request
vi.mock('graphql-request', () => ({
  request: vi.fn(),
  gql: vi.fn((str, ...args) => {
    return str.reduce((acc: any, part: any, i: number) => acc + part + (args[i] || ''), '');
  })
}));

// Mock useDelegateMetadataMapping to avoid network calls
vi.mock('./useDelegateMetadataMapping', () => ({
  useDelegateMetadataMapping: () => ({ data: undefined })
}));

// Lightweight wrapper that doesn't depend on Tenderly
const config = createConfig({
  chains: [mainnet],
  connectors: [mock({ accounts: ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'] })],
  transports: { [mainnet.id]: http() }
});
const queryClient = new QueryClient();

function TestWrapper({ children }: { children?: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

const wrapper = TestWrapper;

type RequestArgs = [string, string, Record<string, any>];

const lastRequest = () => {
  const [call] = (request as Mock).mock.calls as RequestArgs[];
  return { query: call[1], variables: call[2] };
};

describe('useDelegates', async () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Should send the default parameters as variables', async () => {
    const { result } = renderHook(() => useDelegates({ chainId: TENDERLY_CHAIN_ID }), {
      wrapper
    });

    await waitFor(() => result.current.isLoading === false);

    expect(request).toHaveBeenCalled();
    const { query, variables } = lastRequest();

    expect(query).toContain('Delegate(where: $where, limit: $limit, offset: $offset, order_by: $orderBy)');
    expect(variables).toEqual({
      where: { _and: [{ chainId: { _eq: TENDERLY_CHAIN_ID } }] },
      limit: 100,
      offset: 0,
      orderBy: null
    });
  });

  it('Should paginate through the variables', async () => {
    const { result } = renderHook(
      () =>
        useDelegates({
          chainId: TENDERLY_CHAIN_ID,
          page: 2,
          pageSize: 5
        }),
      { wrapper }
    );

    await waitFor(() => result.current.isLoading === false);

    expect(lastRequest().variables).toMatchObject({ limit: 5, offset: 5 });
  });

  it('Should pass the search term as data, not query text', async () => {
    const search = 'delegate" } }] }) { id } #';
    const { result } = renderHook(
      () =>
        useDelegates({
          chainId: TENDERLY_CHAIN_ID,
          page: 1,
          pageSize: 10,
          search
        }),
      { wrapper }
    );

    await waitFor(() => result.current.isLoading === false);

    const { query, variables } = lastRequest();
    expect(query).not.toContain(search);
    expect(variables.where._and).toContainEqual({ address: { _ilike: `%${search}%` } });
    expect(variables).toMatchObject({ limit: 10, offset: 0 });
  });

  it('Should OR name-matched addresses into the search condition', async () => {
    const { result } = renderHook(
      () =>
        useDelegates({
          chainId: TENDERLY_CHAIN_ID,
          page: 1,
          pageSize: 10,
          search: 'cloaky',
          nameMatches: ['0xaaaa000000000000000000000000000000000001']
        }),
      { wrapper }
    );

    await waitFor(() => result.current.isLoading === false);

    expect(lastRequest().variables.where._and).toContainEqual({
      _or: [
        { address: { _ilike: '%cloaky%' } },
        { address: { _ilike: '0xaaaa000000000000000000000000000000000001' } }
      ]
    });
  });

  it('Should exclude addresses through the variables', async () => {
    const { result } = renderHook(
      () =>
        useDelegates({
          chainId: TENDERLY_CHAIN_ID,
          page: 1,
          pageSize: 10,
          exclude: ['0x123', '0x456']
        }),
      { wrapper }
    );

    await waitFor(() => result.current.isLoading === false);

    expect(lastRequest().variables.where._and).toContainEqual({ address: { _nin: ['0x123', '0x456'] } });
  });

  it('Should send a random order_by when random is set', async () => {
    const { result } = renderHook(
      () =>
        useDelegates({
          chainId: TENDERLY_CHAIN_ID,
          page: 1,
          pageSize: 10,
          random: true
        }),
      { wrapper }
    );

    await waitFor(() => result.current.isLoading === false);

    const { orderBy } = lastRequest().variables;
    expect(orderBy).toHaveLength(1);
    expect(Object.values(orderBy[0])).toEqual([expect.stringMatching(/^(asc|desc)$/)]);
  });

  it('Should send no order_by when random is false', async () => {
    const { result } = renderHook(
      () =>
        useDelegates({
          chainId: TENDERLY_CHAIN_ID,
          page: 1,
          pageSize: 10,
          random: false
        }),
      { wrapper }
    );

    await waitFor(() => result.current.isLoading === false);

    expect(lastRequest().variables.orderBy).toBeNull();
  });

  it('should handle zero page size correctly', async () => {
    const { result } = renderHook(
      () =>
        useDelegates({
          chainId: TENDERLY_CHAIN_ID,
          page: 1,
          pageSize: 0
        }),
      { wrapper }
    );

    await waitFor(() => result.current.isLoading === false);

    expect(lastRequest().variables).toMatchObject({ limit: 0, offset: 0 });
  });

  it('Should combine every parameter', async () => {
    const { result } = renderHook(
      () =>
        useDelegates({
          chainId: 1,
          exclude: ['0x123', '0x456'],
          page: 2,
          pageSize: 5,
          random: true,
          search: 'delegate',
          version: 3
        }),
      { wrapper }
    );

    await waitFor(() => result.current.isLoading === false);

    const { variables } = lastRequest();
    expect(variables.where).toEqual({
      _and: [
        { chainId: { _eq: 1 } },
        { version: { _eq: '3' } },
        { address: { _nin: ['0x123', '0x456'] } },
        { address: { _ilike: '%delegate%' } }
      ]
    });
    expect(variables).toMatchObject({ limit: 5, offset: 5 });
    expect(variables.orderBy).toHaveLength(1);
  });
});

describe('useUserDelegates', async () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Should filter by the lowercased user through the variables', async () => {
    const { result } = renderHook(() => useUserDelegates({ chainId: TENDERLY_CHAIN_ID, user: '0xABC' }), {
      wrapper
    });

    await waitFor(() => result.current.isLoading === false);

    const { query, variables } = lastRequest();
    expect(query).toContain('delegations(limit: 1, where: { delegator: { _eq: $delegator } })');
    expect(variables).toEqual({
      where: {
        _and: [
          { chainId: { _eq: TENDERLY_CHAIN_ID } },
          { delegations: { delegator: { _eq: '0xabc' }, amount: { _gt: '0' } } }
        ]
      },
      delegator: '0xabc'
    });
  });

  it('Should pass the search term as data, not query text', async () => {
    const search = 'delegate" } }] }) { id } #';
    const { result } = renderHook(
      () => useUserDelegates({ chainId: TENDERLY_CHAIN_ID, user: '0xabc', search }),
      {
        wrapper
      }
    );

    await waitFor(() => result.current.isLoading === false);

    const { query, variables } = lastRequest();
    expect(query).not.toContain(search);
    expect(variables.where._and).toContainEqual({ address: { _ilike: `%${search}%` } });
  });
});
