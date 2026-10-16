import { describe, expect, it, vi } from 'vitest';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import { TransactionReplacedError } from '@/hooks/helpers';
import { withActionRecording } from './actionRecording';

const setup = () => {
  const inner: TxCallbacks = { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: vi.fn() };
  const onSent = vi.fn();
  const onConfirmed = vi.fn();
  const onReverted = vi.fn();
  const callbacks = withActionRecording(() => inner, { onSent, onConfirmed, onReverted });
  return { inner, onSent, onConfirmed, onReverted, callbacks };
};

const reverted = new Error('Transaction receipt: execution reverted');

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
    callbacks.onError(new TransactionReplacedError(), '0xclaim');
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
