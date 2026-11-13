import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ADDRESS = '0x849D52316331967b6fF1198e5E32A0eB168D039d';

// Partial mock: the hooks suite's setup file connects through the real wagmi.
vi.mock('wagmi', async importOriginal => ({
  ...(await importOriginal<typeof import('wagmi')>()),
  useChainId: () => 1,
  useConnection: () => ({ address: ADDRESS, connector: { id: 'walletConnect' } })
}));

import { useIsSafeWallet } from './useIsSafeWallet';

let statuses: number[];
const fetchMock = vi.fn(
  async () => ({ status: statuses.length > 1 ? statuses.shift()! : statuses[0] }) as Response
);

const renderProbe = () => {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  return renderHook(() => useIsSafeWallet(), { wrapper });
};
const advance = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  vi.useFakeTimers({ shouldAdvanceTime: false });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useIsSafeWallet over WalletConnect', () => {
  it('is a Safe when the transaction service knows the address', async () => {
    statuses = [200];
    const { result } = renderProbe();
    await advance(10);
    expect(result.current).toBe(true);
  });

  it('is not a Safe on a 404, without asking again', async () => {
    statuses = [404];
    const { result } = renderProbe();
    await advance(120_000);
    expect(result.current).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // A rate limit or an outage is no answer: caching it as "not a Safe" would
  // send the Safe's transactions down the plain-wallet path for the session.
  it('keeps asking through service errors until it gets an answer', async () => {
    statuses = [429, 503, 200];
    const { result } = renderProbe();
    await advance(10);
    expect(result.current).toBe(false);
    await advance(10_000);
    expect(result.current).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('gives up after a minute and a half of errors and treats the account as not a Safe', async () => {
    statuses = [503];
    const { result } = renderProbe();
    await advance(120_000);
    expect(result.current).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(7);
    await advance(600_000);
    expect(fetchMock).toHaveBeenCalledTimes(7);
  });
});
