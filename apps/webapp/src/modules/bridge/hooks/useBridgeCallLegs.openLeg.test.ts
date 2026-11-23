/**
 * @vitest-environment happy-dom
 */
// Each single-leg prompt is reported open with its run's context, and answered once, however the wallet answers it.
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAddress, type Call, type PublicClient } from 'viem';
import type { TxMutateVariables } from '@/hooks';
import { useBridgeCallLegs } from './useBridgeCallLegs';

type FlowArgs = {
  onMutate: (variables?: TxMutateVariables) => void;
  onStart: (hash?: string, variables?: TxMutateVariables) => void;
  onError: (error: Error, hash: string, variables?: TxMutateVariables) => void;
};

const mocks = vi.hoisted(() => ({ flows: [] as FlowArgs[], execute: vi.fn() }));

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
    return { prepared: true, error: null, execute: mocks.execute, reset: vi.fn(), detached: false };
  }
}));

const SENDER = getAddress('0x71C7656EC7ab88b098defB751B7401B5f6d8976F');
const CALLS = [{ to: SENDER, data: '0x01' }] as Call[];
const leg = () => ({ functionName: 'depositForBurn', args: [] }) as unknown as TxMutateVariables;
const CONTEXT = { run: 1 };

function mount() {
  const release = vi.fn();
  const onLegPrompt = vi.fn(() => release);
  const { result } = renderHook(() =>
    useBridgeCallLegs({
      calls: CALLS,
      chainId: 8453,
      client: {} as PublicClient,
      from: SENDER,
      sendFunctionName: 'depositForBurn',
      preflight: async () => undefined,
      onLegPrompt,
      getCallbacks: () => ({ onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: vi.fn() })
    })
  );
  return {
    flow: () => mocks.flows.at(-1)!,
    onLegPrompt,
    release,
    execute: () => act(async () => result.current.execute(CONTEXT))
  };
}

describe('useBridgeCallLegs: onLegPrompt', () => {
  beforeEach(() => {
    mocks.flows = [];
    mocks.execute.mockClear();
  });

  it('reports a prompt open with the context of the run that opened it', async () => {
    const view = mount();
    await view.execute();
    const prompt = leg();
    act(() => view.flow().onMutate(prompt));
    expect(view.onLegPrompt).toHaveBeenCalledWith(prompt, CONTEXT);
    expect(view.release).not.toHaveBeenCalled();
  });

  it('releases a prompt once when it is signed, though its receipt fails later', async () => {
    const view = mount();
    await view.execute();
    const prompt = leg();
    act(() => {
      view.flow().onMutate(prompt);
      view.flow().onStart('0xburn', prompt);
      view.flow().onError(new Error('reverted'), '0xburn', prompt);
    });
    expect(view.release).toHaveBeenCalledOnce();
  });

  it('releases a prompt when it is rejected', async () => {
    const view = mount();
    await view.execute();
    const prompt = leg();
    act(() => {
      view.flow().onMutate(prompt);
      view.flow().onError(new Error('User rejected the request'), '', prompt);
    });
    expect(view.release).toHaveBeenCalledOnce();
  });

  it('sends while another prompt of the same account is open', async () => {
    const first = mount();
    await first.execute();
    act(() => first.flow().onMutate(leg()));
    await mount().execute();
    expect(mocks.execute).toHaveBeenCalledTimes(2);
  });
});
