/**
 * @vitest-environment happy-dom
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TxStatus } from '@/modules/ui/lib/txStatus';

const h = vi.hoisted(() => ({ txStatus: 'idle' as string }));
vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({ txStatus: h.txStatus })
}));

import { useTransactionRunActive } from './useTransactionRunActive';

describe('useTransactionRunActive', () => {
  it.each([
    [TxStatus.IDLE, false],
    [TxStatus.INITIALIZED, true],
    [TxStatus.LOADING, true],
    // A failed run can be retried from where it stopped.
    [TxStatus.ERROR, true],
    // Over: nothing should simulate against the post-send state.
    [TxStatus.SUCCESS, false]
  ])('%s → %s', (status, active) => {
    h.txStatus = status;
    expect(renderHook(() => useTransactionRunActive()).result.current).toBe(active);
  });
});
