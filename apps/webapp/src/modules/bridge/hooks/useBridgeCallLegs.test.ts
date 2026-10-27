/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAddress, type Call, type PublicClient } from 'viem';
import type { TxMutateVariables } from '@/hooks';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
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

describe('useBridgeCallLegs bundle success', () => {
  beforeEach(() => {
    Object.assign(mocks, { sequential: [], batch: [], batchPrepared: false });
    Object.values(callbacks).forEach(fn => fn.mockClear());
  });

  // A wallet that runs the bundle as separate transactions lands a claim's sale apart from its receive.
  it('hands its Confirm every transaction of a bundle run apart', () => {
    mocks.batchPrepared = true;
    renderLegs(vi.fn(), true);
    const bundle = mocks.batch.at(-1)! as FlowArgs & {
      onSuccess: (hash?: string, blockNumber?: bigint, bundleTxHashes?: string[]) => void;
    };
    act(() => {
      bundle.onMutate();
      bundle.onStart();
      bundle.onSuccess('0xreceive', 7n, ['0xreceive', '0xsell']);
    });
    expect(callbacks.onSuccess).toHaveBeenCalledWith('0xreceive', 7n, ['0xreceive', '0xsell']);
  });
});

describe('useBridgeCallLegs legMined', () => {
  beforeEach(() => {
    Object.assign(mocks, { sequential: [], batch: [], batchPrepared: false });
  });

  afterEach(() => {
    mocks.sequentialIndex = 0;
  });

  it('says a leg of the run mined once the sequence moved past its first call', () => {
    const view = renderLegs(vi.fn());
    expect(view.result.current.legMined).toBe(false);

    mocks.sequentialIndex = 1;
    view.rerender();
    expect(view.result.current.legMined).toBe(true);
  });

  it('never says so for a bundle, which mines all at once', () => {
    Object.assign(mocks, { batchPrepared: true, sequentialIndex: 1 });
    const view = renderLegs(vi.fn(), true);
    expect(view.result.current.isBatch).toBe(true);
    expect(view.result.current.legMined).toBe(false);
  });
});

describe('useBridgeCallLegs one-at-a-time success', () => {
  beforeEach(() => {
    Object.assign(mocks, { sequential: [], batch: [], batchPrepared: false });
  });

  const confirmCallbacks = () => ({
    onMutate: vi.fn(),
    onStart: vi.fn(),
    onSuccess: vi.fn(),
    onError: vi.fn()
  });
  const renderConfirms = (first: TxCallbacks) => {
    const modal = { current: first };
    const view = renderHook(() =>
      useBridgeCallLegs({
        calls: CALLS,
        chainId: 8453,
        client: {} as PublicClient,
        from: SENDER,
        sendFunctionName: 'depositForBurn',
        preflight: async () => undefined,
        getCallbacks: () => modal.current
      })
    );
    return { modal, ...view };
  };
  const settle = (hash: string) =>
    (
      mocks.sequential.at(-1) as unknown as { onSuccess: (hash: string, blockNumber?: bigint) => void }
    ).onSuccess(hash, 7n);

  it('hands its Confirm the success of its own run', async () => {
    const a = confirmCallbacks();
    const { result } = renderConfirms(a);
    await act(async () => result.current.execute());
    act(() => {
      mocks.sequential.at(-1)!.onMutate(SWAP);
      mocks.sequential.at(-1)!.onStart('0xswap', SWAP);
      mocks.sequential.at(-1)!.onMutate(BURN);
      mocks.sequential.at(-1)!.onStart('0xburn', BURN);
    });
    act(() => settle('0xburn'));
    expect(a.onSuccess).toHaveBeenCalledWith('0xburn', 7n);
  });

  // A claim's sale signed after the modal closed must not mark the card launched next as claimed.
  it('hands no Confirm the success of a run closed while its prompt was open', async () => {
    const a = confirmCallbacks();
    const b = confirmCallbacks();
    const { modal, result } = renderConfirms(a);
    await act(async () => result.current.execute());
    act(() => mocks.sequential.at(-1)!.onMutate(SWAP));
    act(() => result.current.reset());
    modal.current = b;
    act(() => settle('0xswap'));
    expect(a.onSuccess).not.toHaveBeenCalled();
    expect(b.onSuccess).not.toHaveBeenCalled();
  });

  it('never hands the success of an earlier Confirm to the current one', async () => {
    const a = confirmCallbacks();
    const b = confirmCallbacks();
    const { modal, result } = renderConfirms(a);
    await act(async () => result.current.execute());
    act(() => mocks.sequential.at(-1)!.onMutate(BURN));
    modal.current = b;
    act(() => settle('0xburn'));
    expect(b.onSuccess).not.toHaveBeenCalled();
  });
});

describe('useBridgeCallLegs dropCheck', () => {
  beforeEach(() => {
    Object.assign(mocks, { sequential: [], batch: [], batchPrepared: false });
    mocks.sequentialExecute.mockClear();
    Object.values(callbacks).forEach(fn => fn.mockClear());
  });

  const renderChecking = () => {
    const check = { pass: () => undefined as void };
    const view = renderHook(() =>
      useBridgeCallLegs({
        calls: CALLS,
        chainId: 8453,
        client: {} as PublicClient,
        from: SENDER,
        sendFunctionName: 'depositForBurn',
        preflight: () => new Promise<undefined>(resolve => (check.pass = () => resolve(undefined))),
        getCallbacks: () => callbacks
      })
    );
    return { check, ...view };
  };

  // A modal closed while the check reads the chain must not open the wallet behind it.
  it('opens no wallet prompt for a run dropped while its pre-send check is out', async () => {
    const { check, result } = renderChecking();
    act(() => result.current.execute());
    act(() => result.current.dropCheck());
    await act(async () => check.pass());
    expect(mocks.sequentialExecute).not.toHaveBeenCalled();
  });

  it('keeps a run whose wallet prompt is already open', async () => {
    const { check, result } = renderChecking();
    act(() => result.current.execute());
    await act(async () => check.pass());
    expect(mocks.sequentialExecute).toHaveBeenCalledTimes(1);
    act(() => mocks.sequential.at(-1)!.onMutate(BURN));
    act(() => result.current.dropCheck());
    act(() => {
      mocks.sequential.at(-1)!.onStart('0xburn', BURN);
      (mocks.sequential.at(-1) as unknown as { onSuccess: (hash: string) => void }).onSuccess('0xburn');
    });
    expect(callbacks.onSuccess).toHaveBeenCalledWith('0xburn', undefined);
  });
});

// A Retry after a mined leg resumes the rest: the check before it reads what that rest needs, not the whole run.
describe('useBridgeCallLegs preflight', () => {
  afterEach(() => {
    mocks.sequentialNextCalls = undefined;
  });

  const run = async (batch: boolean) => {
    const preflight = vi.fn(async (_client: PublicClient, _nextCalls: readonly Call[]) => undefined);
    const view = renderHook(() =>
      useBridgeCallLegs({
        calls: CALLS,
        chainId: 8453,
        client: {} as PublicClient,
        from: SENDER,
        sendFunctionName: 'depositForBurn',
        preflight,
        batch,
        getCallbacks: () => callbacks
      })
    );
    await act(async () => view.result.current.execute());
    return preflight.mock.calls.at(-1)![1];
  };

  it('gets the calls a sequential run still has to send', async () => {
    mocks.sequentialNextCalls = CALLS.slice(1);
    expect(await run(false)).toEqual(CALLS.slice(1));
  });

  it('gets every call of a bundle, which sends them all again', async () => {
    Object.assign(mocks, { batchPrepared: true, sequentialNextCalls: CALLS.slice(1) });
    expect(await run(true)).toEqual(CALLS);
  });
});

describe('useBridgeCallLegs late send', () => {
  beforeEach(() => {
    Object.assign(mocks, { sequential: [], batch: [], batchPrepared: false });
    Object.values(callbacks).forEach(fn => fn.mockClear());
  });

  // A native deposit's send name follows the form's destination.
  it('records a send signed after its run ended though the form now sends another call', async () => {
    const DEPOSIT = { functionName: 'depositETHTo', args: [] } as unknown as TxMutateVariables;
    const client = { waitForTransactionReceipt: vi.fn(() => new Promise(() => {})) };
    let sendFunctionName = 'depositETHTo';
    const view = renderHook(() =>
      useBridgeCallLegs({
        calls: CALLS,
        chainId: 1,
        client: client as unknown as PublicClient,
        from: SENDER,
        sendFunctionName,
        preflight: async () => undefined,
        getCallbacks: () => callbacks
      })
    );
    await act(async () => view.result.current.execute());
    act(() => mocks.sequential.at(-1)!.onMutate(DEPOSIT));
    act(() => view.result.current.reset());
    sendFunctionName = 'outboundTransfer';
    view.rerender();
    act(() => mocks.sequential.at(-1)!.onStart('0xdeposit', DEPOSIT));
    expect(callbacks.onStart).toHaveBeenCalledWith('0xdeposit');
  });
});
