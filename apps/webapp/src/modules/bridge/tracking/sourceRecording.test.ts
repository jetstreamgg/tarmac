import { describe, expect, it, vi } from 'vitest';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import { withSourceRecording } from './sourceRecording';

const setup = (isSafe: boolean, legs = 2) => {
  const inner: TxCallbacks = { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: vi.fn() };
  const onQueued = vi.fn();
  const onExecuted = vi.fn();
  const callbacks = withSourceRecording(() => inner, { legs, isSafe, onQueued, onExecuted });
  return { inner, onQueued, onExecuted, callbacks };
};

describe('withSourceRecording', () => {
  it('records an EOA bridge once the flow succeeds, with the final hash', () => {
    const { inner, onQueued, onExecuted, callbacks } = setup(false);
    callbacks.onStart('0xapprove');
    callbacks.onStart('0xsend');
    expect(onQueued).not.toHaveBeenCalled();
    callbacks.onSuccess('0xsend');
    expect(onExecuted).toHaveBeenCalledWith('0xsend', undefined);
    expect(inner.onStart).toHaveBeenCalledTimes(2);
    expect(inner.onSuccess).toHaveBeenCalledWith('0xsend');
  });

  it('queues a Safe bridge at the last leg, then hands its Safe tx hash to the execution', () => {
    const { onQueued, onExecuted, callbacks } = setup(true);
    callbacks.onStart('0xsafeapprove');
    expect(onQueued).not.toHaveBeenCalled();
    callbacks.onStart('0xsafesend');
    expect(onQueued).toHaveBeenCalledWith('0xsafesend');
    callbacks.onSuccess('0xexec');
    expect(onExecuted).toHaveBeenCalledWith('0xexec', '0xsafesend');
  });

  it('records nothing when the flow fails', () => {
    const { inner, onExecuted, callbacks } = setup(false, 1);
    callbacks.onStart('0xsend');
    callbacks.onError(new Error('reverted'), '0xsend');
    expect(onExecuted).not.toHaveBeenCalled();
    expect(inner.onError).toHaveBeenCalled();
  });
});
