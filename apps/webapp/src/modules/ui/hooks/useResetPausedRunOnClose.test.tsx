import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TxStatus } from '@/widgets';

const ctx = vi.hoisted(() => ({ isModalOpen: false, txStatus: 'idle' as string }));
vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({ isModalOpen: ctx.isModalOpen, txStatus: ctx.txStatus })
}));

import { useResetPausedRunOnClose } from './useResetPausedRunOnClose';

function renderWith(reset: () => void) {
  const { rerender } = renderHook(() => useResetPausedRunOnClose(reset));
  return (isModalOpen: boolean, txStatus: TxStatus) => {
    ctx.isModalOpen = isModalOpen;
    ctx.txStatus = txStatus;
    rerender();
  };
}

describe('useResetPausedRunOnClose', () => {
  afterEach(() => {
    ctx.isModalOpen = false;
    ctx.txStatus = 'idle';
  });

  it('resets the engine once when the modal closes on a failure', () => {
    const reset = vi.fn();
    const go = renderWith(reset);
    go(true, TxStatus.IDLE);
    go(true, TxStatus.INITIALIZED);
    go(true, TxStatus.ERROR);
    expect(reset).not.toHaveBeenCalled();

    // Close: the provider hides the modal and returns the status to IDLE together.
    go(false, TxStatus.IDLE);
    expect(reset).toHaveBeenCalledTimes(1);

    // Nothing more on later renders while closed.
    go(false, TxStatus.IDLE);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('leaves the engine alone when the modal closes without a failure', () => {
    const reset = vi.fn();
    const go = renderWith(reset);
    go(true, TxStatus.IDLE);
    go(false, TxStatus.IDLE);
    go(true, TxStatus.IDLE);
    go(true, TxStatus.INITIALIZED);
    go(true, TxStatus.LOADING);
    go(true, TxStatus.SUCCESS);
    go(false, TxStatus.IDLE);
    expect(reset).not.toHaveBeenCalled();
  });

  it('a failure that was retried and succeeded no longer counts at close', () => {
    const reset = vi.fn();
    const go = renderWith(reset);
    go(true, TxStatus.ERROR);
    go(true, TxStatus.INITIALIZED);
    go(true, TxStatus.LOADING);
    go(true, TxStatus.SUCCESS);
    go(false, TxStatus.IDLE);
    expect(reset).not.toHaveBeenCalled();
  });

  // The abandon close, not the failure close: the user walks away while a later
  // leg sits in the wallet. The engine only drops its snapshot when the FIRST
  // call is rejected, so a run paused mid-sequence survives here — and the next
  // confirm would resume it, signing the pre-edit amount.
  it('resets when the modal closes while a later leg is still awaiting the wallet', () => {
    const reset = vi.fn();
    const go = renderWith(reset);
    go(true, TxStatus.IDLE);
    go(true, TxStatus.INITIALIZED); // leg 1 in the wallet
    go(true, TxStatus.LOADING); // leg 1 broadcast
    go(true, TxStatus.INITIALIZED); // leg 1 mined, leg 2 now in the wallet
    expect(reset).not.toHaveBeenCalled();

    go(false, TxStatus.IDLE); // the user closes rather than answering
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('resets when the modal closes during the very first wallet prompt', () => {
    const reset = vi.fn();
    const go = renderWith(reset);
    go(true, TxStatus.IDLE);
    go(true, TxStatus.INITIALIZED);
    go(false, TxStatus.IDLE);
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
