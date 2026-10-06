import { describe, expect, it, vi } from 'vitest';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import { withSourceRecording } from './sourceRecording';

const setup = (isSafe: boolean, legs = 2) => {
  const inner: TxCallbacks = { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: vi.fn() };
  const onSent = vi.fn();
  const onQueued = vi.fn();
  const onExecuted = vi.fn();
  const callbacks = withSourceRecording(() => inner, { legs, isSafe, onSent, onQueued, onExecuted });
  return { inner, onSent, onQueued, onExecuted, callbacks };
};

describe('withSourceRecording', () => {
  it('records a bridge as soon as its last leg is broadcast, not when it is mined', () => {
    const { inner, onSent, onQueued, onExecuted, callbacks } = setup(false);
    callbacks.onStart('0xapprove');
    expect(onSent).not.toHaveBeenCalled();
    callbacks.onStart('0xsend');
    expect(onSent).toHaveBeenCalledWith('0xsend');
    callbacks.onSuccess('0xsend');
    expect(onSent).toHaveBeenCalledTimes(1);
    expect(onQueued).not.toHaveBeenCalled();
    expect(onExecuted).not.toHaveBeenCalled();
    expect(inner.onStart).toHaveBeenCalledTimes(2);
    expect(inner.onSuccess).toHaveBeenCalledWith('0xsend');
  });

  it('keeps a broadcast bridge when the receipt wait fails, for the tracker to resolve', () => {
    const { inner, onSent, callbacks } = setup(false, 1);
    callbacks.onStart('0xsend');
    callbacks.onError(new Error('receipt timeout'), '0xsend');
    expect(onSent).toHaveBeenCalledWith('0xsend');
    expect(inner.onError).toHaveBeenCalled();
  });

  it('falls back to the success hash when the start had none', () => {
    const { onSent, callbacks } = setup(false, 1);
    callbacks.onStart(undefined);
    callbacks.onSuccess('0xsend');
    expect(onSent).toHaveBeenCalledWith('0xsend');
  });

  it('records nothing when the wallet rejects before broadcasting', () => {
    const { onSent, callbacks } = setup(false, 1);
    callbacks.onError(new Error('user rejected'));
    expect(onSent).not.toHaveBeenCalled();
  });

  it('queues a Safe bridge at the last leg, then hands its Safe tx hash to the execution', () => {
    const { onSent, onQueued, onExecuted, callbacks } = setup(true);
    callbacks.onStart('0xsafeapprove');
    expect(onQueued).not.toHaveBeenCalled();
    callbacks.onStart('0xsafesend');
    expect(onQueued).toHaveBeenCalledWith('0xsafesend');
    callbacks.onSuccess('0xexec');
    expect(onExecuted).toHaveBeenCalledWith('0xexec', '0xsafesend');
    expect(onSent).not.toHaveBeenCalled();
  });
});
