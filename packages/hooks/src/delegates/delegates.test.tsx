import { describe, expect, it, vi, Mock, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { WagmiWrapper } from '../../test';
import { useDelegates } from './useDelegates';
import { TENDERLY_CHAIN_ID } from '../constants';
import { request } from 'graphql-request';
import { useUserDelegates } from './useUserDelegates';

// Mock the request function from graphql-request
vi.mock('graphql-request', () => ({
  request: vi.fn(),
  gql: vi.fn((str, ...args) => {
    return str.reduce((acc: any, part: any, i: number) => acc + part + (args[i] || ''), '');
  })
}));

const wrapper = WagmiWrapper;
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
    expect(query).toContain('delegates');
    expect(query).toContain('first: 5');
    expect(query).toContain('skip: 5');
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
    expect(query).toContain('{id_contains_nocase: "delegate"}');
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
    expect(query).toContain('id_not_in: ["0x123", "0x456"]');
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

    // Check that the query string contains orderBy and orderDirection parameters
    expect(query).toContain('orderBy:');
    expect(query).toContain('orderDirection:');
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

    // Check that the query string does not contain orderBy and orderDirection parameters
    expect(query).not.toContain('orderBy:');
    expect(query).not.toContain('orderDirection:');
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
    expect(query).toContain('delegates');
    expect(query).toContain('first: 0');
    expect(query).toContain('skip: 0');
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
    expect(query).toContain('id_not_in: ["0x123", "0x456"]');
    expect(query).toContain('{id_contains_nocase: "delegate"}');

    // Check that the query string contains the correct pagination clause
    expect(query).toContain('first: 5');
    expect(query).toContain('skip: 5');

    // Check that the query string contains the correct orderBy and orderDirection parameters
    expect(query).toContain('orderBy:');
    expect(query).toContain('orderDirection:');
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

    expect(query).toContain('delegations_: {delegator_contains_nocase: "0xabc", amount_gt: 0}');
    expect(query).toContain(`
        delegations(
          first: 1000
          where: {delegator_not_in: ["0xce01c90de7fd1bcfa39e237fe6d8d9f569e8a6a3", "0xb1fc11f03b084fff8dae95fa08e8d69ad2547ec1"]}
        ) {`);
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

    expect(query).toContain('{id_contains_nocase: "delegate"}');
    expect(query).toContain('delegations_: {delegator_contains_nocase: "0xabc", amount_gt: 0}');
    expect(query).toContain(`
        delegations(
          first: 1000
          where: {delegator_not_in: ["0xce01c90de7fd1bcfa39e237fe6d8d9f569e8a6a3", "0xb1fc11f03b084fff8dae95fa08e8d69ad2547ec1"]}
        ) {`);
  });
});

const checkDefaultQueryParameters = (query: string) => {
  expect(query).toContain('delegates');
  expect(query).toContain('first: 10');
  expect(query).toContain('skip: 0');
};
