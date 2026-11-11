import { describe, expect, it, vi } from 'vitest';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import { TransactionReplacedError, TransactionRevertedError } from '@/hooks/shared/useTransactionOutcome';
import { withActionRecording } from './actionRecording';

const setup = () => {
  const inner: TxCallbacks = { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: vi.fn() };
  const onSent = vi.fn();
  const onConfirmed = vi.fn();
  const onReverted = vi.fn();
  const callbacks = withActionRecording(() => inner, { onSent, onConfirmed, onReverted });
  return { inner, onSent, onConfirmed, onReverted, callbacks };
};

const reverted = new TransactionRevertedError();

describe('withActionRecording', () => {
  it('records the action as sent at broadcast, then confirms it once mined', () => {
    const { inner, onSent, onConfirmed, callbacks } = setup();
    callbacks.onMutate({ functionName: 'claim' });
    callbacks.onStart('0xclaim');
    expect(onSent).toHaveBeenCalledWith('0xclaim');
    expect(onConfirmed).not.toHaveBeenCalled();
    callbacks.onSuccess('0xclaim', 42n);
    expect(onConfirmed).toHaveBeenCalledWith('0xclaim');
    expect(onSent).toHaveBeenCalledTimes(1);
    expect(inner.onMutate).toHaveBeenCalled();
    expect(inner.onStart).toHaveBeenCalledWith('0xclaim');
    expect(inner.onSuccess).toHaveBeenCalledWith('0xclaim', 42n);
  });

  // A wallet that runs a bundle as separate transactions: the claim's sale lands in another one.
  it('confirms a bundle run apart with every transaction it ran', () => {
    const { inner, onConfirmed, callbacks } = setup();
    callbacks.onStart(undefined);
    callbacks.onSuccess('0xreceive', 7n, ['0xreceive', '0xsell']);
    expect(onConfirmed).toHaveBeenCalledWith('0xreceive', ['0xreceive', '0xsell']);
    expect(inner.onSuccess).toHaveBeenCalledWith('0xreceive', 7n, ['0xreceive', '0xsell']);
  });

  it('drops the sent action when its transaction reverted', () => {
    const { inner, onReverted, callbacks } = setup();
    callbacks.onStart('0xclaim');
    callbacks.onError(reverted, '0xclaim');
    expect(onReverted).toHaveBeenCalledWith('0xclaim');
    expect(inner.onError).toHaveBeenCalledWith(reverted, '0xclaim');
  });

  it('keeps the sent action when the receipt wait fails without a revert', () => {
    const { onReverted, callbacks } = setup();
    callbacks.onStart('0xclaim');
    callbacks.onError(new Error('Timed out while waiting for transaction'), '0xclaim');
    expect(onReverted).not.toHaveBeenCalled();
  });

  it('drops nothing for a revert reported with another hash, or before broadcast', () => {
    const { onReverted, callbacks } = setup();
    callbacks.onError(reverted);
    callbacks.onStart('0xclaim');
    callbacks.onError(reverted, '0xother');
    expect(onReverted).not.toHaveBeenCalled();
  });

  it('confirms with the success hash when the start had none', () => {
    const { onSent, onConfirmed, callbacks } = setup();
    callbacks.onStart(undefined);
    expect(onSent).not.toHaveBeenCalled();
    callbacks.onSuccess('0xclaim');
    expect(onConfirmed).toHaveBeenCalledWith('0xclaim');
  });
});

describe('withActionRecording, a sent action cancelled or replaced in the wallet', () => {
  it('drops the sent action, so the user can claim again', () => {
    const { onReverted, callbacks } = setup();
    callbacks.onStart('0xclaim');
    callbacks.onError(
      new TransactionReplacedError(new Error('Transaction replaced in the wallet.')),
      '0xclaim'
    );
    expect(onReverted).toHaveBeenCalledWith('0xclaim');
  });
});

describe('withActionRecording, a sent action sped up in the wallet', () => {
  it('drops the action sent first when the faster transaction reverts', () => {
    const { onSent, onReverted, callbacks } = setup();
    callbacks.onStart('0xclaim');
    callbacks.onStart('0xfaster');
    expect(onSent).toHaveBeenCalledTimes(1);
    callbacks.onError(reverted, '0xfaster');
    expect(onReverted).toHaveBeenCalledWith('0xclaim');
  });
});

describe('withActionRecording, an action signed after other legs', () => {
  const setupLegs = () => {
    const onSent = vi.fn();
    const onConfirmed = vi.fn();
    const onReverted = vi.fn();
    const inner: TxCallbacks = { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: vi.fn() };
    const callbacks = withActionRecording(() => inner, {
      onSent,
      onConfirmed,
      onReverted,
      actionFunctionName: 'sellGem',
      confirmOnNextLeg: true
    });
    const leg = (functionName: string, hash: string) => {
      callbacks.onMutate({ functionName });
      callbacks.onStart(hash);
    };
    return { inner, onSent, onConfirmed, onReverted, callbacks, leg };
  };

  it('never records the approve before the action as the action', () => {
    const { onSent, onConfirmed, onReverted, callbacks, leg } = setupLegs();
    leg('approve', '0xapprove');
    expect(onSent).not.toHaveBeenCalled();
    callbacks.onMutate({ functionName: 'sellGem' });
    callbacks.onError(new Error('User rejected the request.'));
    expect(onSent).not.toHaveBeenCalled();
    expect(onConfirmed).not.toHaveBeenCalled();
    expect(onReverted).not.toHaveBeenCalled();
  });

  it('records the action from its own leg, after the approve', () => {
    const { inner, onSent, onConfirmed, callbacks, leg } = setupLegs();
    leg('approve', '0xapprove');
    leg('sellGem', '0xsell');
    expect(onSent).toHaveBeenCalledExactlyOnceWith('0xsell');
    callbacks.onSuccess('0xsell');
    expect(onConfirmed).toHaveBeenCalledExactlyOnceWith('0xsell');
    expect(inner.onStart).toHaveBeenCalledWith('0xapprove');
  });

  it('drops nothing when the approve before the action reverts', () => {
    const { onReverted, callbacks, leg } = setupLegs();
    leg('approve', '0xapprove');
    callbacks.onError(reverted, '0xapprove');
    expect(onReverted).not.toHaveBeenCalled();
  });

  it('drops the action sped up in the wallet when the faster one reverts', () => {
    const { onSent, onReverted, callbacks, leg } = setupLegs();
    leg('approve', '0xapprove');
    leg('sellGem', '0xsell');
    callbacks.onStart('0xfaster');
    expect(onSent).toHaveBeenCalledTimes(1);
    callbacks.onError(reverted, '0xfaster');
    expect(onReverted).toHaveBeenCalledExactlyOnceWith('0xsell');
  });
});

describe('withActionRecording, an action followed by other legs', () => {
  const setupLegs = ({ confirmOnNextLeg = true }: { confirmOnNextLeg?: boolean } = {}) => {
    const onSent = vi.fn();
    const onConfirmed = vi.fn();
    const onReverted = vi.fn();
    const inner: TxCallbacks = { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: vi.fn() };
    const callbacks = withActionRecording(() => inner, {
      onSent,
      onConfirmed,
      onReverted,
      actionFunctionName: 'receiveMessage',
      confirmOnNextLeg
    });
    const leg = (functionName: string, hash: string) => {
      callbacks.onMutate({ functionName });
      callbacks.onStart(hash);
    };
    return { onSent, onConfirmed, onReverted, callbacks, leg };
  };

  // The next leg is sent only once the one before it mined.
  it('confirms the action under its own hash once a later leg starts, and keeps it when the sale reverts', () => {
    const { onSent, onConfirmed, onReverted, callbacks, leg } = setupLegs();
    leg('receiveMessage', '0xreceive');
    expect(onSent).toHaveBeenCalledExactlyOnceWith('0xreceive');
    leg('approve', '0xapprove');
    expect(onConfirmed).toHaveBeenCalledExactlyOnceWith('0xreceive');
    leg('sellGem', '0xsell');
    callbacks.onError(reverted, '0xsell');
    expect(onReverted).not.toHaveBeenCalled();
    expect(onConfirmed).toHaveBeenCalledTimes(1);
  });

  it('confirms the sped-up action under the hash that mined', () => {
    const { onConfirmed, callbacks, leg } = setupLegs();
    leg('receiveMessage', '0xreceive');
    callbacks.onStart('0xfaster');
    leg('sellGem', '0xsell');
    expect(onConfirmed).toHaveBeenCalledExactlyOnceWith('0xfaster');
  });

  it('still confirms the last leg once the run succeeds, on the action, so its sale is read', () => {
    const { onConfirmed, callbacks, leg } = setupLegs();
    leg('receiveMessage', '0xreceive');
    leg('sellGem', '0xsell');
    callbacks.onSuccess('0xsell');
    expect(onConfirmed.mock.calls).toEqual([['0xreceive'], ['0xreceive', ['0xreceive', '0xsell']]]);
  });

  it('for a Safe, confirms nothing early and drops nothing when the sale reverts on chain', () => {
    const { onSent, onConfirmed, onReverted, callbacks, leg } = setupLegs({ confirmOnNextLeg: false });
    leg('receiveMessage', '0xsafe-receive');
    leg('approve', '0xsafe-approve');
    leg('sellGem', '0xsafe-sell');
    expect(onSent).toHaveBeenCalledExactlyOnceWith('0xsafe-receive');
    expect(onConfirmed).not.toHaveBeenCalled();
    callbacks.onError(reverted, '0xsafe-sell');
    expect(onReverted).not.toHaveBeenCalled();
  });

  it('drops the action when its own leg reverts', () => {
    const { onReverted, callbacks, leg } = setupLegs();
    leg('receiveMessage', '0xreceive');
    callbacks.onError(reverted, '0xreceive');
    expect(onReverted).toHaveBeenCalledExactlyOnceWith('0xreceive');
  });
});

// A bundle starts with no hash: the action was recorded as sent under the wallet's calls id.
describe('withActionRecording, an action sent as a wallet bundle', () => {
  const bundleSetup = (calls: string | null = '0xcalls') => {
    const inner: TxCallbacks = { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: vi.fn() };
    const onReverted = vi.fn();
    const onConfirmed = vi.fn();
    const callbacks = withActionRecording(() => inner, {
      onSent: vi.fn(),
      onConfirmed,
      onReverted,
      readBundle: () => calls ?? undefined
    });
    return { inner, onReverted, onConfirmed, callbacks };
  };
  const batchFailed = new Error('ERROR: Batch transaction failed');

  it.each([
    ['failed', batchFailed, undefined],
    ['reverted in one of its transactions', batchFailed, '0xsell'],
    ['reverted', reverted, '0xreceive']
  ])('drops it by its calls id when the bundle %s', (_, error, hash) => {
    const { inner, onReverted, callbacks } = bundleSetup();
    callbacks.onStart(undefined);
    callbacks.onError(error, hash);
    expect(onReverted).toHaveBeenCalledWith('0xcalls');
    expect(inner.onError).toHaveBeenCalledWith(error, hash);
  });

  it('keeps it when the wait fails without the bundle failing, or once it succeeded', () => {
    const waiting = bundleSetup();
    waiting.callbacks.onStart(undefined);
    waiting.callbacks.onError(new Error('Timed out while waiting for transaction'), '0xreceive');
    expect(waiting.onReverted).not.toHaveBeenCalled();

    const done = bundleSetup();
    done.callbacks.onStart(undefined);
    done.callbacks.onSuccess('0xreceive', 7n, ['0xreceive', '0xsell']);
    done.callbacks.onError(batchFailed);
    expect(done.onConfirmed).toHaveBeenCalledWith('0xreceive', ['0xreceive', '0xsell']);
    expect(done.onReverted).not.toHaveBeenCalled();
  });

  it('drops nothing when no bundle was recorded, or for a failure before the wallet accepted it', () => {
    const none = bundleSetup(null);
    none.callbacks.onStart(undefined);
    none.callbacks.onError(batchFailed);
    expect(none.onReverted).not.toHaveBeenCalled();

    const early = bundleSetup();
    early.callbacks.onError(batchFailed);
    expect(early.onReverted).not.toHaveBeenCalled();
  });
});
