import { describe, expect, it, vi } from 'vitest';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import { BatchFailedError } from '@/hooks/shared/useSendBatchTransactionFlow';
import { unconfirmedReason } from '@/hooks/shared/useTransactionOutcome';
import { withSourceRecording } from './sourceRecording';

// The batch engine reports a bundle with no function name and no hash when the wallet accepts it.
const setup = (isSafe = false, onBundleSent?: () => boolean) => {
  const inner: TxCallbacks = { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: vi.fn() };
  const spies = {
    onSent: vi.fn(),
    onQueued: vi.fn(),
    onExecuted: vi.fn(),
    onFailed: vi.fn(),
    onRepriced: vi.fn(),
    onBundled: vi.fn(() => 'bundle-1'),
    onBundleMined: vi.fn()
  };
  const callbacks = withSourceRecording(() => inner, {
    isSafe,
    bridgeFunctionName: 'send',
    ...spies,
    onBundleSent
  });
  const accept = () => {
    callbacks.onMutate(undefined);
    callbacks.onStart(undefined);
  };
  return { inner, callbacks, accept, ...spies };
};

describe('withSourceRecording, a wallet bundle', () => {
  it('records the bundle once when the wallet accepts it, before any hash', () => {
    const { inner, accept, onBundled, onSent } = setup();
    accept();
    expect(onBundled).toHaveBeenCalledTimes(1);
    expect(onSent).not.toHaveBeenCalled();
    expect(inner.onStart).toHaveBeenCalledWith(undefined);
  });

  it("never records the success hash as the deposit: it can be the approve's", () => {
    const { callbacks, accept, onSent, onBundleMined, inner } = setup();
    accept();
    callbacks.onSuccess('0xapprove', 7n);
    expect(onSent).not.toHaveBeenCalled();
    expect(onBundleMined).toHaveBeenCalledWith('bundle-1', '0xapprove');
    expect(inner.onSuccess).toHaveBeenCalledWith('0xapprove', 7n);
  });

  it('fails the card when the bundle settles as failed, so Retry may send again', () => {
    const { callbacks, accept, onFailed } = setup();
    accept();
    callbacks.onError(new Error('ERROR: Batch transaction failed'), undefined);
    expect(onFailed).toHaveBeenCalledWith('bundle-1', 'source-tx-reverted');
  });

  it("doesn't fail the card when the failed bundle's send mined anyway", () => {
    const onBundleSent = vi.fn(() => true);
    const { callbacks, accept, onFailed, inner } = setup(false, onBundleSent);
    accept();
    const receipts = [
      { status: 'success', transactionHash: '0xdeposit', blockNumber: 7n, logs: [] }
    ] as const;
    const error = new BatchFailedError(receipts);
    callbacks.onError(error, undefined);
    expect(onBundleSent).toHaveBeenCalledWith('bundle-1', receipts);
    expect(onFailed).not.toHaveBeenCalled();
    // The modal tells to follow its card, not to send again.
    expect(unconfirmedReason(error)).toMatch(/follow it on its card/);
    expect(inner.onError).toHaveBeenCalledWith(error, undefined);
  });

  it("fails the card when the failed bundle's receipts hold no send of it", () => {
    const { callbacks, accept, onFailed } = setup(false, () => false);
    accept();
    callbacks.onError(new BatchFailedError([]), undefined);
    expect(onFailed).toHaveBeenCalledWith('bundle-1', 'source-tx-reverted');
  });

  it('keeps the card on an error that does not prove the funds stayed', () => {
    const { callbacks, accept, onFailed, inner } = setup();
    accept();
    callbacks.onError(new Error('HTTP request failed.'), undefined);
    expect(onFailed).not.toHaveBeenCalled();
    expect(inner.onError).toHaveBeenCalled();
  });

  it('records nothing for a bundle the wallet rejected', () => {
    const { callbacks, onBundled, onFailed } = setup();
    callbacks.onMutate(undefined);
    callbacks.onError(new Error('User rejected the request.'), undefined);
    expect(onBundled).not.toHaveBeenCalled();
    expect(onFailed).not.toHaveBeenCalled();
  });

  it('never records a bundle for a Safe', () => {
    const { accept, onBundled, onQueued } = setup(true);
    accept();
    expect(onBundled).not.toHaveBeenCalled();
    expect(onQueued).not.toHaveBeenCalled();
  });

  it('records a hashless start of the approve leg as nothing', () => {
    const { callbacks, onBundled } = setup();
    callbacks.onMutate({ functionName: 'approve' });
    callbacks.onStart(undefined);
    expect(onBundled).not.toHaveBeenCalled();
  });
});
