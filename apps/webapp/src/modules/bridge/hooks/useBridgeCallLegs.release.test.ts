/**
 * @vitest-environment happy-dom
 */
// A run whose outcome the card read on chain is released: its engine drops it, and nothing it reports later reaches the modal.
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAddress, type Call, type PublicClient } from 'viem';
import type { TxMutateVariables } from '@/hooks';
import { useBridgeCallLegs } from './useBridgeCallLegs';

type FlowArgs = {
  onMutate: (variables?: TxMutateVariables) => void;
  onStart: (hash?: string, variables?: TxMutateVariables) => void;
  onSuccess: (hash: string, blockNumber?: bigint) => void;
};

const mocks = vi.hoisted(() => ({ flows: [] as FlowArgs[], execute: vi.fn(), release: vi.fn() }));

vi.mock('@/hooks/shared/useSendBatchTransactionFlow', () => ({
  useSendBatchTransactionFlow: () => ({
    execute: vi.fn(),
    reset: vi.fn(),
    prepared: false,
    isLoading: false,
    error: null,
    currentCallIndex: 0,
    batchUnavailable: true
  })
}));
vi.mock('@/hooks/shared/useSequentialTransactionFlow', () => ({
  useSequentialTransactionFlow: (args: FlowArgs) => {
    mocks.flows.push(args);
    return {
      prepared: true,
      error: null,
      execute: mocks.execute,
      reset: vi.fn(),
      release: mocks.release,
      detached: false
    };
  }
}));

const SENDER = getAddress('0x71C7656EC7ab88b098defB751B7401B5f6d8976F');
const CALLS = [{ to: SENDER, data: '0x01' }] as Call[];
const HASH = `0x${'c'.repeat(64)}`;

describe('useBridgeCallLegs: release', () => {
  const callbacks = { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: vi.fn() };
  beforeEach(() => {
    mocks.flows = [];
    mocks.execute.mockClear();
    mocks.release.mockClear();
    Object.values(callbacks).forEach(fn => fn.mockClear());
  });

  const mount = async () => {
    const { result } = renderHook(() =>
      useBridgeCallLegs({
        calls: CALLS,
        chainId: 1,
        client: {} as PublicClient,
        from: SENDER,
        sendFunctionName: 'receiveMessage',
        preflight: async () => undefined,
        getCallbacks: () => callbacks
      })
    );
    await act(async () => result.current.execute());
    const flow = mocks.flows.at(-1)!;
    const prompt = { functionName: 'receiveMessage', args: [] } as unknown as TxMutateVariables;
    act(() => flow.onMutate(prompt));
    act(() => flow.onStart(HASH, prompt));
    return { result, flow };
  };

  it("drops the engine's run", async () => {
    const { result } = await mount();
    act(() => result.current.release());
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });

  it('reports nothing the released run settles later', async () => {
    const { result, flow } = await mount();
    act(() => result.current.release());
    act(() => flow.onSuccess(HASH, 7n));
    expect(callbacks.onSuccess).not.toHaveBeenCalled();
  });

  it('control: an unreleased run reports its success', async () => {
    const { flow } = await mount();
    act(() => flow.onSuccess(HASH, 7n));
    expect(callbacks.onSuccess).toHaveBeenCalledWith(HASH, 7n);
  });
});
