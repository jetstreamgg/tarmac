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

const sent = vi.hoisted(() => ({ id: undefined as string | undefined }));
const callsStatus = vi.hoisted(() => ({
  isLoading: false,
  isSuccess: false,
  error: null,
  failureReason: null,
  data: undefined as
    | {
        status: 'success' | 'failure';
        receipts: { status: 'success' | 'reverted'; transactionHash: string; blockNumber: bigint }[];
      }
    | undefined
}));

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
  useSendCalls: () => ({
    sendCalls,
    error: null,
    data: sent.id ? { id: sent.id } : undefined,
    reset: () => {}
  }),
  useWaitForCallsStatus: () => callsStatus,
  useChainId: () => 1,
  // No client: a reverted leg isn't replayed for its reason (covered in
  // modules/ui/context/sendBatchTransactionFlow.test.tsx).
  usePublicClient: () => undefined
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined, isFetched: false })
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
  sent.id = undefined;
  callsStatus.isSuccess = false;
  callsStatus.data = undefined;
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

describe('useSendBatchTransactionFlow — settling', () => {
  const settle = (
    status: 'success' | 'failure',
    receiptStatuses: ('success' | 'reverted')[]
  ): { onSuccess: ReturnType<typeof vi.fn>; onError: ReturnType<typeof vi.fn> } => {
    sent.id = '0xbundle';
    callsStatus.isSuccess = true;
    callsStatus.data = {
      status,
      receipts: receiptStatuses.map((receiptStatus, i) => ({
        status: receiptStatus,
        transactionHash: `0x${i + 1}`,
        blockNumber: BigInt(i + 1)
      }))
    };
    const onSuccess = vi.fn();
    const onError = vi.fn();
    renderHook(() => useSendBatchTransactionFlow({ calls, enabled: true, onSuccess, onError }));
    return { onSuccess, onError };
  };

  it('reports success when every leg landed', () => {
    const { onSuccess, onError } = settle('success', ['success', 'success']);

    expect(onSuccess).toHaveBeenCalledWith('0x1', 2n);
    expect(onError).not.toHaveBeenCalled();
  });

  it('reports a failure when a leg reverted under an overall success (Ambire on an EOA, APP-637)', () => {
    const { onSuccess, onError } = settle('success', ['success', 'reverted']);

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][1]).toBe('0x2');
  });

  it('reports a failure when the wallet says the bundle failed', () => {
    const { onSuccess, onError } = settle('failure', []);

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('reports the reverted leg of a partially failed bundle', () => {
    const { onSuccess, onError } = settle('failure', ['success', 'reverted']);

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][1]).toBe('0x2');
  });
});
