import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TxStatus } from '@/modules/ui/lib/txStatus';

const ctx = vi.hoisted(() => ({ isModalOpen: false, txStatus: 'idle' as string }));
vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({ isModalOpen: ctx.isModalOpen, txStatus: ctx.txStatus })
}));

import { useResetPausedRunOnClose } from './useResetPausedRunOnClose';

function renderWith(reset: () => void, refetch?: () => void) {
  const { rerender } = renderHook(() => useResetPausedRunOnClose(reset, refetch));
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

  // An approve signed after the close would mine behind a reset engine and a
  // refetched allowance, and the next launch would ask for it again.
  it('leaves the engine alone when the modal closes before anything went out', () => {
    const reset = vi.fn();
    const go = renderWith(reset);
    go(true, TxStatus.IDLE);
    go(false, TxStatus.IDLE);
    go(true, TxStatus.IDLE);
    go(true, TxStatus.INITIALIZED);
    go(false, TxStatus.IDLE);
    expect(reset).not.toHaveBeenCalled();
  });

  it('a failure followed by Back and a fresh confirm no longer counts at close', () => {
    const reset = vi.fn();
    const go = renderWith(reset);
    go(true, TxStatus.INITIALIZED);
    go(true, TxStatus.ERROR);
    go(true, TxStatus.IDLE);
    go(true, TxStatus.INITIALIZED);
    go(false, TxStatus.IDLE);
    expect(reset).not.toHaveBeenCalled();
  });

  it('a Retry after a mined step still counts at close', () => {
    const reset = vi.fn();
    const go = renderWith(reset);
    go(true, TxStatus.INITIALIZED);
    go(true, TxStatus.LOADING);
    go(true, TxStatus.ERROR);
    go(true, TxStatus.INITIALIZED);
    go(false, TxStatus.IDLE);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  // Closed while a later step waits in the wallet: the wallet's rejection then
  // pauses the run with no ERROR ever reaching this session.
  it('resets the engine when the modal closes mid-run, without a failure shown', () => {
    const reset = vi.fn();
    const go = renderWith(reset);
    go(true, TxStatus.INITIALIZED);
    go(true, TxStatus.LOADING);
    go(true, TxStatus.INITIALIZED);
    go(false, TxStatus.IDLE);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('refetches the engine reads with the reset, so a mined approve drops out of the next launch', () => {
    const reset = vi.fn();
    const refetch = vi.fn();
    const go = renderWith(reset, refetch);
    go(true, TxStatus.INITIALIZED);
    go(true, TxStatus.ERROR);
    expect(refetch).not.toHaveBeenCalled();

    go(false, TxStatus.IDLE);
    expect(reset).toHaveBeenCalledTimes(1);
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
