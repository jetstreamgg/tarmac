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

describe('useDelegates', async () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Should build the right query with default parameters', async () => {
    const { result } = renderHook(() => useDelegates({ chainId: TENDERLY_CHAIN_ID }), {
      wrapper
    });

    await waitFor(() => result.current.isLoading === false);

    // Check that the request function was called
    expect(request).toHaveBeenCalled();

    // Extract the query string from the request call
    const [[, query]] = (request as Mock).mock.calls;

    // Check that the query string is correct
    checkDefaultQueryParameters(query);
  });

  it('Should build the correct query with different page sizes', async () => {
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

    // Check that the request function was called
    expect(request).toHaveBeenCalled();

    // Extract the query string from the request call
    const [[, query]] = (request as Mock).mock.calls;

    // Check that the query string is correct
    expect(query).toContain('Delegate');
    expect(query).toContain('limit: 5');
    expect(query).toContain('offset: 5');
  });

  it('Should build the correct query with search parameter', async () => {
    const { result } = renderHook(
      () =>
        useDelegates({
          chainId: TENDERLY_CHAIN_ID,
          page: 1,
          pageSize: 10,
          search: 'delegate'
        }),
      { wrapper }
    );

    await waitFor(() => result.current.isLoading === false);

    // Check that the request function was called
    expect(request).toHaveBeenCalled();

    // Extract the query string from the request call
    const [[, query]] = (request as Mock).mock.calls;

    // Check that the query string contains the search parameter
    expect(query).toContain('{ address: { _ilike: "%delegate%" } }');
    checkDefaultQueryParameters(query);
  });

  it('Should build the correct query with exclude parameter', async () => {
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

    // Check that the request function was called
    expect(request).toHaveBeenCalled();

    // Extract the query string from the request call
    const [[, query]] = (request as Mock).mock.calls;

    // Check that the query string contains the exclude parameter
    expect(query).toContain('{ address: { _nin: ["0x123", "0x456"] } }');
    checkDefaultQueryParameters(query);
  });

  it('Should build the correct query with random order parameters', async () => {
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

    // Check that the request function was called
    expect(request).toHaveBeenCalled();

    // Extract the query string from the request call
    const [[, query]] = (request as Mock).mock.calls;

    // Check that the query string contains order_by parameter
    expect(query).toContain('order_by:');
    checkDefaultQueryParameters(query);
  });

  it('Should build the correct query without order parameters when random is false', async () => {
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

    // Check that the request function was called
    expect(request).toHaveBeenCalled();

    // Extract the query string from the request call
    const [[, query]] = (request as Mock).mock.calls;

    // Check that the query string does not contain order_by parameter
    expect(query).not.toContain('order_by:');
    checkDefaultQueryParameters(query);
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

    // Check that the request function was called
    expect(request).toHaveBeenCalled();

    // Extract the query string from the request call
    const [[, query]] = (request as Mock).mock.calls;

    // Check that the query string is correct
    expect(query).toContain('Delegate');
    expect(query).toContain('limit: 0');
    expect(query).toContain('offset: 0');
  });

  it('Should build the correct query with all parameters', async () => {
    const { result } = renderHook(
      () =>
        useDelegates({
          chainId: 1,
          exclude: ['0x123', '0x456'],
          page: 2,
          pageSize: 5,
          random: true,
          search: 'delegate'
        }),
      { wrapper }
    );

    await waitFor(() => result.current.isLoading === false);

    // Check that the request function was called
    expect(request).toHaveBeenCalled();

    // Extract the query string from the request call
    const [[, query]] = (request as Mock).mock.calls;

    // Check that the query string contains the correct where clause
    expect(query).toContain('{ address: { _nin: ["0x123", "0x456"] } }');
    expect(query).toContain('{ address: { _ilike: "%delegate%" } }');

    // Check that the query string contains the correct pagination clause
    expect(query).toContain('limit: 5');
    expect(query).toContain('offset: 5');

    // Check that the query string contains order_by parameter
    expect(query).toContain('order_by:');
  });
});

describe('useUserDelegates', async () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Should build the right query with default parameters', async () => {
    const { result } = renderHook(() => useUserDelegates({ chainId: TENDERLY_CHAIN_ID, user: '0xabc' }), {
      wrapper
    });

    await waitFor(() => result.current.isLoading === false);

    expect(request).toHaveBeenCalled();
    const [[, query]] = (request as Mock).mock.calls;

    expect(query).toContain('{ delegations: { delegator: { _ilike: "%0xabc%" }, amount: { _gt: "0" } } }');
    expect(query).toContain(`delegations(
          limit: 1
          where: { delegator: { _ilike: "%0xabc%" } }`);
  });

  it('Should build the correct query with search parameter', async () => {
    const { result } = renderHook(
      () => useUserDelegates({ chainId: TENDERLY_CHAIN_ID, user: '0xabc', search: 'delegate' }),
      {
        wrapper
      }
    );

    await waitFor(() => result.current.isLoading === false);

    expect(request).toHaveBeenCalled();

    const [[, query]] = (request as Mock).mock.calls;

    expect(query).toContain('{ address: { _ilike: "%delegate%" } }');
    expect(query).toContain('{ delegations: { delegator: { _ilike: "%0xabc%" }, amount: { _gt: "0" } } }');
    expect(query).toContain(`delegations(
          limit: 1
          where: { delegator: { _ilike: "%0xabc%" } }`);
  });
});

const checkDefaultQueryParameters = (query: string) => {
  expect(query).toContain('Delegate');
  expect(query).toContain('limit: 100');
  expect(query).toContain('offset: 0');
};
