import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRejectedRequestError, type Hash } from 'viem';

const h = vi.hoisted(() => ({
  isSafeWallet: true,
  chainId: 1,
  onChain: new Set<string>()
}));

// Partial mocks: the hooks suite's setup file connects through the real wagmi.
vi.mock('wagmi', async importOriginal => ({
  ...(await importOriginal<typeof import('wagmi')>()),
  useChainId: () => h.chainId,
  useConfig: () => ({})
}));

vi.mock('wagmi/actions', async importOriginal => ({
  ...(await importOriginal<typeof import('wagmi/actions')>()),
  getPublicClient: () => ({
    getTransaction: async ({ hash }: { hash: string }) => {
      if (h.onChain.has(hash)) return { hash };
      throw new Error('TransactionNotFoundError');
    }
  })
}));

vi.mock('../wallet/useIsSafeWallet', () => ({
  useIsSafeWallet: () => h.isSafeWallet
}));

import {
  resolveSafeTx,
  safePollDelay,
  useWaitForSafeTxHash,
  type SafeTxResolution
} from './useWaitForSafeTxHash';
import {
  MAX_RETRY_DELAY_MS,
  TransactionReplacedError,
  TransactionRevertedError
} from './useTransactionOutcome';
import { SAFE_TRANSACTION_SERVICE_URL } from './constants';

const SERVICE = SAFE_TRANSACTION_SERVICE_URL[1];
const SAFE = '0x849D52316331967b6fF1198e5E32A0eB168D039d';
const SAFE_TX_HASH = `0x${'aa'.repeat(32)}` as Hash;
const OTHER_SAFE_TX_HASH = `0x${'cc'.repeat(32)}` as Hash;
const EXECUTED_HASH = `0x${'bb'.repeat(32)}` as Hash;
const NONCE = 5;

type ServiceTx = {
  safe: string;
  nonce: number;
  safeTxHash: string;
  transactionHash: string | null;
  isSuccessful: boolean | null;
};

const tx = (overrides: Partial<ServiceTx> = {}): ServiceTx => ({
  safe: SAFE,
  nonce: NONCE,
  safeTxHash: SAFE_TX_HASH,
  transactionHash: null,
  isSuccessful: null,
  ...overrides
});
const executed = (overrides: Partial<ServiceTx> = {}) =>
  tx({ transactionHash: EXECUTED_HASH, isSuccessful: true, ...overrides });
/** What an on-chain rejection or a replacement leaves at our nonce. */
const competitor = () =>
  executed({ safeTxHash: OTHER_SAFE_TX_HASH, transactionHash: `0x${'dd'.repeat(32)}` });

/** Every transaction the service knows; `status` makes it answer with an error instead. */
let service: { txs: ServiceTx[]; status?: number };
const fetchMock = vi.fn(async (input: string) => {
  const json = (status: number, body?: unknown) =>
    ({ status, ok: status >= 200 && status < 300, json: async () => body }) as Response;
  if (service.status) return json(service.status);
  const url = new URL(input);
  if (!input.startsWith(`${SERVICE}/`)) return json(404);
  const byHash = url.pathname.match(/\/api\/v1\/multisig-transactions\/(0x[0-9a-f]{64})\/$/);
  if (byHash) {
    const found = service.txs.find(t => t.safeTxHash === byHash[1]);
    return found ? json(200, found) : json(404);
  }
  if (url.pathname.endsWith(`/api/v1/safes/${SAFE}/multisig-transactions/`)) {
    const nonce = Number(url.searchParams.get('nonce'));
    return json(200, { results: service.txs.filter(t => t.nonce === nonce) });
  }
  return json(404);
});

const QUEUED: SafeTxResolution = { status: 'pending', queued: { safe: SAFE, nonce: String(NONCE) } };

beforeEach(() => {
  h.isSafeWallet = true;
  h.chainId = 1;
  h.onChain = new Set();
  service = { txs: [] };
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const isOnChain = vi.fn(async (hash: Hash) => h.onChain.has(hash));
const resolve = (previous?: SafeTxResolution, hash: Hash = SAFE_TX_HASH) =>
  resolveSafeTx({ hash, serviceUrl: SERVICE, isOnChain, previous });

describe('resolveSafeTx — before the service has shown the hash in a queue', () => {
  beforeEach(() => isOnChain.mockClear());

  // A 1-of-1 Safe over WalletConnect executes straight away and returns the real hash.
  it('uses a returned hash our RPC already knows without asking the service', async () => {
    h.onChain.add(EXECUTED_HASH);
    expect(await resolve(undefined, EXECUTED_HASH)).toEqual({ status: 'executed', hash: EXECUTED_HASH });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats a 404 as not indexed yet, then resolves once the service has it', async () => {
    const first = await resolve();
    expect(first).toEqual({ status: 'pending' });
    service.txs = [executed()];
    expect(await resolve(first)).toEqual({ status: 'executed', hash: EXECUTED_HASH });
  });

  it('remembers the Safe and nonce of a transaction it finds queued', async () => {
    service.txs = [tx()];
    expect(await resolve()).toEqual(QUEUED);
  });

  it('throws on a service error so the query retries rather than settling', async () => {
    service.status = 503;
    await expect(resolve()).rejects.toThrow('503');
  });

  it('falls back to the returned hash on a chain with no transaction service', async () => {
    const result = await resolveSafeTx({
      hash: SAFE_TX_HASH,
      serviceUrl: undefined,
      isOnChain: async () => false
    });
    expect(result).toEqual({ status: 'executed', hash: SAFE_TX_HASH });
  });
});

describe('resolveSafeTx — a queued transaction', () => {
  beforeEach(() => isOnChain.mockClear());

  it('stays pending on one service call, with no RPC lookup, while nothing executed at its nonce', async () => {
    service.txs = [tx()];
    expect(await resolve(QUEUED)).toEqual(QUEUED);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(isOnChain).not.toHaveBeenCalled();
  });

  it('resolves to the on-chain hash once the owners execute it', async () => {
    service.txs = [executed()];
    expect(await resolve(QUEUED)).toEqual({ status: 'executed', hash: EXECUTED_HASH });
  });

  it('is rejected once another transaction executed at its nonce', async () => {
    service.txs = [tx(), competitor()];
    expect(await resolve(QUEUED)).toEqual({ status: 'rejected' });
  });

  it('reports an execution whose inner call failed as reverted, on its on-chain hash', async () => {
    service.txs = [executed({ isSuccessful: false })];
    expect(await resolve(QUEUED)).toEqual({ status: 'reverted', hash: EXECUTED_HASH });
    expect(await resolve()).toEqual({ status: 'reverted', hash: EXECUTED_HASH });
  });

  // "Delete from the queue" in Safe{Wallet}: the record goes, the nonce never moves.
  it('is rejected once the service has dropped it three looks running', async () => {
    const first = await resolve(QUEUED);
    const second = await resolve(first);
    expect(second).toEqual({ ...QUEUED, misses: 2 });
    expect(await resolve(second)).toEqual({ status: 'rejected' });
  });

  it('forgets a miss when the transaction shows up again', async () => {
    const missed = await resolve(QUEUED);
    expect(missed).toEqual({ ...QUEUED, misses: 1 });
    service.txs = [tx()];
    expect(await resolve(missed)).toEqual(QUEUED);
  });

  it('does not count a miss while the service still has the transaction itself', async () => {
    service.txs = [tx({ nonce: NONCE + 1 })];
    expect(await resolve(QUEUED)).toEqual(QUEUED);
    service.txs = [executed({ nonce: NONCE + 1 })];
    expect(await resolve(QUEUED)).toEqual({ status: 'executed', hash: EXECUTED_HASH });
  });
});

describe('safePollDelay', () => {
  it('polls every 2s for the first 5 minutes, then backs off to the ceiling without ever stopping', () => {
    expect(safePollDelay(1)).toBe(2_000);
    expect(safePollDelay(149)).toBe(2_000);
    expect(safePollDelay(150)).toBeGreaterThan(2_000);
    expect(safePollDelay(170)).toBe(MAX_RETRY_DELAY_MS);
    expect(safePollDelay(10_000)).toBe(MAX_RETRY_DELAY_MS);
  });
});

describe('useWaitForSafeTxHash', () => {
  const renderResolver = (chainId: number | undefined = 1) => {
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);
    return renderHook(() => useWaitForSafeTxHash({ chainId, safeTxHash: SAFE_TX_HASH }), { wrapper });
  };
  const advance = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: false }));

  it('does nothing for a wallet that is not a Safe', async () => {
    h.isSafeWallet = false;
    const { result } = renderResolver();
    await advance(10_000);
    expect(result.current).toMatchObject({ transactionHash: undefined, failure: null, isSafeWallet: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // The old lookup stopped after 150 polls (5 minutes); co-signers can take longer.
  it('keeps polling a queued transaction past 150 polls and resolves when it executes', async () => {
    service.txs = [tx()];
    const { result } = renderResolver();

    await advance(170 * MAX_RETRY_DELAY_MS);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(150);
    expect(result.current.transactionHash).toBeUndefined();

    service.txs = [executed()];
    await advance(MAX_RETRY_DELAY_MS);
    expect(result.current.transactionHash).toBe(EXECUTED_HASH);
    expect(result.current.failure).toBeNull();
  });

  it('reports a rejection as a declined transaction, and the outcome then stays put', async () => {
    service.txs = [tx(), competitor()];
    const { result } = renderResolver();

    await advance(2_100);
    expect(result.current.transactionHash).toBeUndefined();
    expect(result.current.failure).toBeInstanceOf(TransactionReplacedError);
    expect(result.current.failure).toBeInstanceOf(UserRejectedRequestError);
    expect(result.current.failureHash).toBeUndefined();

    // Neither the interval nor a tab refocus asks again, whatever the service says now.
    const calls = fetchMock.mock.calls.length;
    const failure = result.current.failure;
    service.txs = [executed()];
    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await advance(10 * MAX_RETRY_DELAY_MS);
    expect(fetchMock.mock.calls.length).toBe(calls);
    expect(result.current.failure).toBe(failure);
    focusManager.setFocused(undefined);
  });

  it('reports a failed execution as a revert, with its on-chain hash', async () => {
    service.txs = [executed({ isSuccessful: false })];
    const { result } = renderResolver();

    await advance(10);
    expect(result.current.transactionHash).toBeUndefined();
    expect(result.current.failure).toBeInstanceOf(TransactionRevertedError);
    expect(result.current.failureHash).toBe(EXECUTED_HASH);
  });

  // Co-signers can take hours; the wallet session may have moved chains by then.
  it('keeps watching on the chain the transaction was sent on, as a Safe, after the wallet moves', async () => {
    service.txs = [tx()];
    const { result, rerender } = renderResolver(undefined);
    await advance(2_100);

    h.chainId = 8453;
    h.isSafeWallet = false;
    rerender();
    fetchMock.mockClear();
    await advance(10_000);

    expect(result.current.isSafeWallet).toBe(true);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
    for (const [url] of fetchMock.mock.calls) expect(url.startsWith(`${SERVICE}/`)).toBe(true);
  });

  it('starts resolving when the Safe probe answers after the hash arrived', async () => {
    h.isSafeWallet = false;
    service.txs = [executed()];
    const { result, rerender } = renderResolver();
    await advance(2_100);
    expect(fetchMock).not.toHaveBeenCalled();

    h.isSafeWallet = true;
    rerender();
    await advance(10);
    expect(result.current.transactionHash).toBe(EXECUTED_HASH);
  });
});
