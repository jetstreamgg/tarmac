/**
 * @vitest-environment happy-dom
 */
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAddress, type Call, type PublicClient } from 'viem';
import type { TxMutateVariables } from '@/hooks';
import { useBridgeCallLegs } from './useBridgeCallLegs';

const SENDER = getAddress('0x71C7656EC7ab88b098defB751B7401B5f6d8976F');
const CALLS = [
  { to: SENDER, data: '0x01' },
  { to: SENDER, data: '0x02' }
] as Call[];

type FlowArgs = {
  onMutate: (variables?: TxMutateVariables) => void;
  onStart: (hash?: string, variables?: TxMutateVariables) => void;
};

const mocks = vi.hoisted(() => ({
  sequential: [] as FlowArgs[],
  batch: [] as FlowArgs[],
  batchPrepared: false,
  sequentialIndex: 0,
  sequentialNextCalls: undefined as Call[] | undefined,
  sequentialExecute: vi.fn()
}));

vi.mock('@/hooks/shared/useSendBatchTransactionFlow', () => ({
  useSendBatchTransactionFlow: (args: FlowArgs) => {
    mocks.batch.push(args);
    return {
      execute: vi.fn(),
      reset: vi.fn(),
      prepared: mocks.batchPrepared,
      isLoading: false,
      error: null,
      currentCallIndex: 0,
      batchUnavailable: false
    };
  }
}));
vi.mock('@/hooks/shared/useSequentialTransactionFlow', () => ({
  useSequentialTransactionFlow: (args: FlowArgs) => {
    mocks.sequential.push(args);
    return {
      prepared: true,
      error: null,
      execute: mocks.sequentialExecute,
      reset: vi.fn(),
      currentCallIndex: mocks.sequentialIndex,
      nextCalls: mocks.sequentialNextCalls ?? []
    };
  }
}));

const callbacks = { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: vi.fn() };

const renderLegs = (initial: { batch: boolean; batchPending: boolean }) =>
  renderHook(
    ({ batch, batchPending }) =>
      useBridgeCallLegs({
        calls: CALLS,
        chainId: 1,
        client: {} as PublicClient,
        from: SENDER,
        sendFunctionName: 'receiveMessage',
        preflight: async () => undefined,
        batch,
        batchPending,
        getCallbacks: () => callbacks
      }),
    { initialProps: initial }
  );

describe('useBridgeCallLegs batchPending', () => {
  beforeEach(() => {
    Object.assign(mocks, { sequential: [], batch: [], batchPrepared: true });
  });

  // A Confirm fired at the first ready would fix the run as one leg at a time (item 41).
  it('is not ready while the wallet may still bundle, though its legs one at a time are', () => {
    const { result, rerender } = renderLegs({ batch: false, batchPending: true });
    expect(result.current.ready).toBe(false);

    rerender({ batch: true, batchPending: false });
    expect(result.current).toMatchObject({ ready: true, isBatch: true });
  });

  it('is ready one leg at a time once the wallet is known not to bundle', () => {
    const { result, rerender } = renderLegs({ batch: false, batchPending: true });
    rerender({ batch: false, batchPending: false });
    expect(result.current).toMatchObject({ ready: true, isBatch: false });
  });
});
