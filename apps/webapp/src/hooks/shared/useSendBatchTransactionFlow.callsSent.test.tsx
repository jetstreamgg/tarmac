import { renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { erc20Abi, type Call } from 'viem';

type MutationOptions = {
  onMutate?: () => void;
  onSuccess?: (data: { id: string }) => void;
  onError?: (error: Error) => void;
};

const mocks = vi.hoisted(() => ({
  sendCalls: vi.fn(),
  mutation: undefined as MutationOptions | undefined
}));

vi.mock('./useIsBatchSupported', () => ({
  useIsBatchSupported: () => ({ data: true, isLoading: false, error: null })
}));

vi.mock('./useSimulateBatch', () => ({
  useSimulateBatch: () => ({
    prepared: true,
    isLoading: false,
    error: null,
    structuralFailure: false,
    refetch: () => {}
  })
}));

vi.mock('wagmi', () => ({
  useSendCalls: ({ mutation }: { mutation: MutationOptions }) => {
    mocks.mutation = mutation;
    return { sendCalls: mocks.sendCalls, error: null, data: undefined, reset: () => {} };
  },
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
  mocks.sendCalls.mockClear();
  mocks.mutation = undefined;
});

afterEach(cleanup);

describe('useSendBatchTransactionFlow, the id of a bundle the wallet accepted', () => {
  it('is passed to onCallsSent before onStart, so the bundle is recorded with it', () => {
    const order: string[] = [];
    const onCallsSent = vi.fn((id: string) => order.push(`calls:${id}`));
    const onStart = vi.fn((hash?: string) => order.push(`start:${hash}`));
    renderHook(() => useSendBatchTransactionFlow({ calls, enabled: true, onCallsSent, onStart }));

    mocks.mutation?.onSuccess?.({ id: '0xcalls' });

    expect(onCallsSent).toHaveBeenCalledTimes(1);
    expect(onCallsSent).toHaveBeenCalledWith('0xcalls');
    expect(order).toEqual(['calls:0xcalls', 'start:undefined']);
  });

  it('is never sent to the wallet as a sendCalls parameter', () => {
    const onCallsSent = vi.fn();
    const { result } = renderHook(() => useSendBatchTransactionFlow({ calls, enabled: true, onCallsSent }));

    result.current.execute();

    expect(mocks.sendCalls).toHaveBeenCalledTimes(1);
    const [parameters] = mocks.sendCalls.mock.calls[0] as [Record<string, unknown>];
    expect(parameters).not.toHaveProperty('onCallsSent');
    expect(Object.values(parameters)).not.toContain(onCallsSent);
    expect(parameters.calls).toBe(calls);
  });

  it('still starts the flow when no one listens for it', () => {
    const onStart = vi.fn();
    renderHook(() => useSendBatchTransactionFlow({ calls, enabled: true, onStart }));

    mocks.mutation?.onSuccess?.({ id: '0xcalls' });

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith(undefined);
  });
});
