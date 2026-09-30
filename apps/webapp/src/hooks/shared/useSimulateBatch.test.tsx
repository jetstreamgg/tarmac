/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { erc20Abi, type Call } from 'viem';

const simulateBatch = vi.hoisted(() => vi.fn());
const reportError = vi.hoisted(() => vi.fn());

vi.mock('wagmi', () => ({
  useChainId: () => 1,
  useAccount: () => ({ address: '0x0650CAF159C5A49f711e8169D4336ECB9b950275' }),
  usePublicClient: () => ({})
}));
vi.mock('./simulateBatch', async importOriginal => ({
  ...(await importOriginal<typeof import('./simulateBatch')>()),
  simulateBatch
}));
vi.mock('@/modules/sentry/reportError', () => ({ reportError }));
vi.mock('./useBatchExecutorFallbackClients', () => ({ useBatchExecutorFallbackClients: () => [] }));

import { BatchSimulationError } from './simulateBatch';
import { resetBatchSimulationReports, useSimulateBatch } from './useSimulateBatch';

const call: Call = {
  to: '0xdC035D45d973E3EC169d2276DDab16f1e407384F',
  abi: erc20Abi,
  functionName: 'approve',
  args: ['0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD', 1n]
} as unknown as Call;
const calls = [call];

const render = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useSimulateBatch({ calls }), { wrapper });
};

beforeEach(() => {
  simulateBatch.mockReset();
  reportError.mockReset();
  resetBatchSimulationReports();
});
afterEach(cleanup);

describe('useSimulateBatch', () => {
  it('is prepared once the bundle simulated clean', async () => {
    // The regression that shipped to dev: a query function resolving `undefined` is an
    // error to TanStack Query, so a clean simulation read as a failed one.
    simulateBatch.mockResolvedValue([{ success: true, returnData: '0x' }]);

    const { result } = render();

    await waitFor(() => expect(result.current.prepared).toBe(true));
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(reportError).not.toHaveBeenCalled();
  });

  it('fails closed on a revert without retrying or reporting it, like the sequential flow', async () => {
    simulateBatch.mockRejectedValue(
      new BatchSimulationError('Batch simulation: call 1 (approve) reverted', {
        kind: 'reverted',
        callIndex: 0
      })
    );

    const { result } = render();

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.prepared).toBe(false);
    expect(result.current.structuralFailure).toBe(false);
    expect(simulateBatch).toHaveBeenCalledTimes(1);
    expect(reportError).not.toHaveBeenCalled();
  });

  it('flags a structural failure for the router and reports it once per chain', async () => {
    const rpcError = Object.assign(new Error('Missing or invalid parameters. Request: from 0xabc…'), {
      code: -32602
    });
    simulateBatch.mockRejectedValue(
      new BatchSimulationError('invalid params', { kind: 'structural', cause: rpcError })
    );

    const { result } = render();

    await waitFor(() => expect(result.current.structuralFailure).toBe(true));
    expect(result.current.prepared).toBe(false);
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError.mock.calls[0][1]).toMatchObject({ type: 'structural', level: 'error' });
    // Without the RPC error it wraps: viem's message carries the request, address included.
    const reported = reportError.mock.calls[0][0] as Error;
    expect(reported.message).toBe('invalid params');
    expect(reported.cause).toBeUndefined();
    expect(reportError.mock.calls[0][1].extra).toMatchObject({ rpcCode: -32602 });

    // A second flow on the same chain (a new amount, another modal) stays quiet.
    const second = render();
    await waitFor(() => expect(second.result.current.structuralFailure).toBe(true));
    expect(reportError).toHaveBeenCalledTimes(1);
  });

  it('retries a transient failure and comes good', async () => {
    simulateBatch
      .mockRejectedValueOnce(new BatchSimulationError('HTTP request failed', { kind: 'transient' }))
      .mockResolvedValue([]);

    const { result } = render();

    await waitFor(() => expect(result.current.prepared).toBe(true));
    expect(simulateBatch).toHaveBeenCalledTimes(2);
    expect(reportError).not.toHaveBeenCalled();
  });
});
