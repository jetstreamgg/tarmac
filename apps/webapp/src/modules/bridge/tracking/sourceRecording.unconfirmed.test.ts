import { describe, expect, it, vi } from 'vitest';
import { UnknownBundleIdError, UserRejectedRequestError } from 'viem';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import {
  TransactionReplacedError,
  TransactionRevertedError,
  unconfirmedReason
} from '@/hooks/shared/useTransactionOutcome';
import { withSourceRecording } from './sourceRecording';

const setup = (isSafe = false) => {
  const inner: TxCallbacks = { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: vi.fn() };
  const onFailed = vi.fn();
  const callbacks = withSourceRecording(() => inner, {
    isSafe,
    bridgeFunctionName: 'send',
    onSent: vi.fn(),
    onQueued: vi.fn(),
    onExecuted: vi.fn(),
    onFailed,
    onRepriced: vi.fn(),
    onBundled: () => 'bundle-1'
  });
  const forwarded = () => vi.mocked(inner.onError).mock.calls.at(-1)?.[0];
  return { callbacks, forwarded, onFailed };
};

// APP-649: the bridge went out but its outcome can't be read, so the modal must not say it was rolled back.
describe('withSourceRecording, a sent bridge whose outcome is unknown', () => {
  it('marks a bundle whose status the wallet can no longer give as unconfirmed, keeping its error', () => {
    const { callbacks, forwarded, onFailed } = setup();
    callbacks.onMutate(undefined);
    callbacks.onStart(undefined);
    const error = new UnknownBundleIdError(new Error('unknown bundle'));
    callbacks.onError(error, undefined);
    // The same error, for its analytics and Sentry grouping.
    expect(forwarded()).toBe(error);
    expect(unconfirmedReason(error)).toMatch(/card/);
    expect(onFailed).not.toHaveBeenCalled();
  });

  it('marks a sent leg whose receipt could not be read', () => {
    const { callbacks, forwarded } = setup();
    callbacks.onMutate({ functionName: 'send' });
    callbacks.onStart('0xsend');
    callbacks.onError(new Error('HTTP request failed.'), '0xsend');
    expect(unconfirmedReason(forwarded())).toMatch(/card/);
  });

  it('never marks a settled failure, a rejection, another leg or a Safe', () => {
    const failed = (run: (callbacks: TxCallbacks) => void, isSafe = false) => {
      const { callbacks, forwarded } = setup(isSafe);
      run(callbacks);
      return unconfirmedReason(forwarded());
    };
    // The bundle settled as failed, or reverted.
    expect(
      failed(callbacks => {
        callbacks.onMutate(undefined);
        callbacks.onStart(undefined);
        callbacks.onError(new Error('ERROR: Batch transaction failed'), undefined);
      })
    ).toBeUndefined();
    // Rejected in the wallet: nothing was sent.
    expect(
      failed(callbacks => {
        callbacks.onMutate(undefined);
        callbacks.onError(new UserRejectedRequestError(new Error('rejected')), undefined);
      })
    ).toBeUndefined();
    for (const error of [new TransactionRevertedError(), new TransactionReplacedError(new Error('replaced'))])
      expect(
        failed(callbacks => {
          callbacks.onMutate({ functionName: 'send' });
          callbacks.onStart('0xsend');
          callbacks.onError(error, '0xsend');
        })
      ).toBeUndefined();
    // The approve before the bridge leg.
    expect(
      failed(callbacks => {
        callbacks.onMutate({ functionName: 'approve' });
        callbacks.onStart('0xapprove');
        callbacks.onError(new Error('HTTP request failed.'), '0xapprove');
      })
    ).toBeUndefined();
    // A Safe's queue is read by its tracker (APP-567 resolves its on-chain hash).
    expect(
      failed(callbacks => {
        callbacks.onMutate({ functionName: 'send' });
        callbacks.onStart('0xsafetx');
        callbacks.onError(new Error('HTTP request failed.'), '0xsafetx');
      }, true)
    ).toBeUndefined();
  });
});
