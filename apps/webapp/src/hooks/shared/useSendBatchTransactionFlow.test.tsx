import { renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { erc20Abi, type Call } from 'viem';

const capabilities = vi.hoisted(() => ({
  data: true as boolean | undefined,
  isLoading: false,
  error: null as Error | null
}));

const simulation = vi.hoisted(() => ({
  prepared: false,
  isLoading: true,
  error: null as Error | null,
  structuralFailure: false,
  refetch: () => {}
}));

const simulateSpy = vi.hoisted(() => vi.fn());
const sendCalls = vi.hoisted(() => vi.fn());

vi.mock('./useIsBatchSupported', () => ({
  useIsBatchSupported: () => capabilities
}));

vi.mock('./useSimulateBatch', () => ({
  useSimulateBatch: (parameters: unknown) => {
    simulateSpy(parameters);
    return simulation;
  }
}));

vi.mock('wagmi', () => ({
  useSendCalls: () => ({ sendCalls, error: null, data: undefined, reset: () => {} }),
  useWaitForCallsStatus: () => ({
    isLoading: false,
    isSuccess: false,
    error: null,
    failureReason: null,
    data: undefined
  })
}));

import { useSendBatchTransactionFlow } from './useSendBatchTransactionFlow';

const call: Call = {
  to: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  abi: erc20Abi,
  functionName: 'approve',
  args: ['0xA188EEC8F81263234dA3622A406892F3D630f98c', 1n]
} as unknown as Call;
const calls = [call, call];

beforeEach(() => {
  simulateSpy.mockClear();
  sendCalls.mockClear();
  capabilities.data = true;
  capabilities.isLoading = false;
  capabilities.error = null;
  simulation.prepared = false;
  simulation.isLoading = true;
  simulation.error = null;
  simulation.structuralFailure = false;
});

afterEach(cleanup);

describe('useSendBatchTransactionFlow — the prepare gate', () => {
  it('is not prepared, and loading, while the simulation runs', () => {
    const { result } = renderHook(() => useSendBatchTransactionFlow({ calls, enabled: true }));

    expect(result.current.prepared).toBe(false);
    expect(result.current.isLoading).toBe(true);
  });

  it('is prepared once the bundle simulated clean', () => {
    simulation.prepared = true;
    simulation.isLoading = false;

    const { result } = renderHook(() => useSendBatchTransactionFlow({ calls, enabled: true }));

    expect(result.current.prepared).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('fails closed on a reverting bundle and surfaces the reason', () => {
    simulation.isLoading = false;
    simulation.error = new Error('Batch simulation: call 2 (deposit) Dai/insufficient-allowance');

    const { result } = renderHook(() => useSendBatchTransactionFlow({ calls, enabled: true }));

    expect(result.current.prepared).toBe(false);
    expect(result.current.error?.message).toContain('Dai/insufficient-allowance');
  });

  it('never sends a bundle that did not simulate clean, even if execute() is forced', () => {
    simulation.isLoading = false;
    simulation.error = new Error('Batch simulation failed: HTTP request failed.');
    const onError = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useSendBatchTransactionFlow({ calls, enabled: true, onError }));
    result.current.execute();

    expect(sendCalls).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toContain('failed simulation');
  });

  it('sends once prepared', () => {
    simulation.prepared = true;
    simulation.isLoading = false;

    const { result } = renderHook(() => useSendBatchTransactionFlow({ calls, enabled: true }));
    result.current.execute();

    expect(sendCalls).toHaveBeenCalledTimes(1);
  });

  it('reports the structural class so the router can fall back to sequential', () => {
    simulation.isLoading = false;
    simulation.structuralFailure = true;
    simulation.error = new Error('Batch simulation failed: invalid params');

    const { result } = renderHook(() => useSendBatchTransactionFlow({ calls, enabled: true }));

    expect(result.current.batchUnavailable).toBe(true);
    expect(result.current.prepared).toBe(false);
  });
});

describe('useSendBatchTransactionFlow — when the simulation runs', () => {
  it('follows `enabled` by default', () => {
    renderHook(() => useSendBatchTransactionFlow({ calls, enabled: false }));

    expect(simulateSpy.mock.lastCall?.[0].enabled).toBe(false);
  });

  it('can be started ahead of the send leg, so it does not wait on the wallet probe', () => {
    renderHook(() => useSendBatchTransactionFlow({ calls, enabled: false, simulateEnabled: true }));

    expect(simulateSpy.mock.lastCall?.[0].enabled).toBe(true);
    expect(simulateSpy.mock.lastCall?.[0].calls).toBe(calls);
  });
});
