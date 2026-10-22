/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAddress, type Call, type PublicClient } from 'viem';
import type { TxMutateVariables } from '@/hooks';
import {
  TransactionRefusedError,
  TransactionReplacedError,
  TransactionRevertedError
} from '@/hooks/shared/useTransactionOutcome';
import { useBridgeCallLegs } from './useBridgeCallLegs';

const SENDER = getAddress('0x71C7656EC7ab88b098defB751B7401B5f6d8976F');
const CALLS = [
  { to: SENDER, data: '0x01' },
  { to: SENDER, data: '0x02' }
] as Call[];
const SWAP = { functionName: 'swapExactIn', args: [] } as unknown as TxMutateVariables;
const BURN = { functionName: 'depositForBurn', args: [] } as unknown as TxMutateVariables;

type FlowArgs = {
  onMutate: (variables?: TxMutateVariables) => void;
  onStart: (hash?: string, variables?: TxMutateVariables) => void;
};

const mocks = vi.hoisted(() => ({
  sequential: [] as FlowArgs[],
  batch: [] as FlowArgs[],
  batchPrepared: false
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
    return { prepared: true, error: null, execute: vi.fn(), reset: vi.fn() };
  }
}));

const callbacks = { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: vi.fn() };

function renderLegs(onLegSent: (hash: string, variables: TxMutateVariables) => void, batch = false) {
  return renderHook(() =>
    useBridgeCallLegs({
      calls: CALLS,
      chainId: 8453,
      client: {} as PublicClient,
      from: SENDER,
      sendFunctionName: 'depositForBurn',
      preflight: async () => undefined,
      batch,
      onLegSent,
      getCallbacks: () => callbacks
    })
  );
}

describe('useBridgeCallLegs onLegSent', () => {
  beforeEach(() => {
    Object.assign(mocks, { sequential: [], batch: [], batchPrepared: false });
    Object.values(callbacks).forEach(fn => fn.mockClear());
  });

  it('reports every leg the wallet sends one at a time, with its hash and call', () => {
    const onLegSent = vi.fn();
    renderLegs(onLegSent);
    const flow = mocks.sequential.at(-1)!;
    act(() => {
      flow.onMutate(SWAP);
      flow.onStart('0xswap', SWAP);
      flow.onMutate(BURN);
      flow.onStart('0xburn', BURN);
    });
    expect(onLegSent.mock.calls).toEqual([
      ['0xswap', SWAP],
      ['0xburn', BURN]
    ]);
  });

  // A swap signed after the modal closed still moved the funds, so it must still be remembered.
  it('reports a leg signed after its run ended, though the run drops it', () => {
    const onLegSent = vi.fn();
    const { result } = renderLegs(onLegSent);
    const flow = mocks.sequential.at(-1)!;
    act(() => flow.onMutate(SWAP));
    act(() => result.current.reset());
    act(() => flow.onStart('0xswap', SWAP));
    expect(onLegSent).toHaveBeenCalledWith('0xswap', SWAP);
    expect(callbacks.onStart).not.toHaveBeenCalled();
  });

  it('reports nothing without a hash or the call', () => {
    const onLegSent = vi.fn();
    renderLegs(onLegSent);
    const flow = mocks.sequential.at(-1)!;
    act(() => {
      flow.onStart(undefined, SWAP);
      flow.onStart('0xswap', undefined);
    });
    expect(onLegSent).not.toHaveBeenCalled();
  });

  // An atomic bundle leaves no swap without its burn.
  it('reports nothing for a wallet bundle', () => {
    mocks.batchPrepared = true;
    const onLegSent = vi.fn();
    renderLegs(onLegSent, true);
    const bundle = mocks.batch.at(-1)!;
    act(() => {
      bundle.onMutate();
      bundle.onStart();
    });
    expect(onLegSent).not.toHaveBeenCalled();
  });
});

describe('useBridgeCallLegs onLegFailed', () => {
  beforeEach(() => {
    Object.assign(mocks, { sequential: [], batch: [], batchPrepared: false });
    Object.values(callbacks).forEach(fn => fn.mockClear());
  });

  const renderFailing = (onLegFailed: (hash: string) => void) =>
    renderHook(() =>
      useBridgeCallLegs({
        calls: CALLS,
        chainId: 8453,
        client: {} as PublicClient,
        from: SENDER,
        sendFunctionName: 'depositForBurn',
        preflight: async () => undefined,
        onLegFailed,
        getCallbacks: () => callbacks
      })
    );
  const failLeg = (error: Error, hash: string) =>
    (mocks.sequential.at(-1) as unknown as { onError: (error: Error, hash: string) => void }).onError(
      error,
      hash
    );

  // A swap that reverts after the modal closed must not be offered to continue.
  it('reports a leg whose receipt reverted or that was replaced, though its run ended', () => {
    const onLegFailed = vi.fn();
    const { result } = renderFailing(onLegFailed);
    act(() => mocks.sequential.at(-1)!.onStart('0xswap', SWAP));
    act(() => result.current.reset());
    act(() => {
      failLeg(new TransactionRevertedError(), '0xswap');
      failLeg(new TransactionReplacedError(new Error('replaced')), '0xother');
    });
    expect(onLegFailed.mock.calls).toEqual([['0xswap'], ['0xother']]);
    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  it('reports no rejection, refusal or failure without a hash', () => {
    const onLegFailed = vi.fn();
    renderFailing(onLegFailed);
    act(() => {
      failLeg(new Error('User rejected the request.'), '0xswap');
      failLeg(new TransactionRefusedError('refused'), '0xswap');
      failLeg(new TransactionRevertedError(), '');
    });
    expect(onLegFailed).not.toHaveBeenCalled();
  });
});
