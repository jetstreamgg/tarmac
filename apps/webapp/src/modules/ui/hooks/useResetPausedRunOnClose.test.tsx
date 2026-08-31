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
});
