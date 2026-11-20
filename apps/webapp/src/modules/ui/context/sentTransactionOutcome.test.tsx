import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The outcome both engines settle on, for a hash the Safe App may have returned.

const h = vi.hoisted(() => ({
  safe: { transactionHash: undefined, isSafeApp: true } as {
    transactionHash: `0x${string}` | undefined;
    isSafeApp: boolean;
  },
  outcome: { isPending: false, isSuccess: false, failure: null as Error | null },
  watched: {} as { txHash?: string; chainId?: number }
}));

vi.mock('@/hooks/shared/useOnChainTransactionOutcome', () => ({
  useOnChainTransactionOutcome: (watched: { txHash?: string; chainId?: number }) => {
    h.watched = watched;
    return { ...h.outcome, receipt: undefined };
  }
}));

vi.mock('@/hooks/shared/useWaitForSafeTxHash', () => ({
  useWaitForSafeTxHash: () => h.safe
}));

import { useSentTransactionOutcome } from '@/hooks/shared/useSentTransactionOutcome';

const SAFE_TX_HASH = '0xsafetx' as const;
const EXECUTED_HASH = '0xexecuted' as const;

const render = () => renderHook(() => useSentTransactionOutcome({ sentHash: SAFE_TX_HASH }));

beforeEach(() => {
  h.safe = { transactionHash: undefined, isSafeApp: true };
  h.outcome = { isPending: false, isSuccess: false, failure: null };
  h.watched = {};
});

describe('useSentTransactionOutcome', () => {
  it('waits on a queued safeTxHash without watching it on-chain', () => {
    const { result } = render();
    expect(h.watched.txHash).toBeUndefined();
    expect(result.current).toMatchObject({ isAwaitingOutcome: true, txHash: undefined });
  });

  it('watches the executed hash once the Safe has run the transaction', () => {
    h.safe = { transactionHash: EXECUTED_HASH, isSafeApp: true };
    h.outcome = { isPending: false, isSuccess: true, failure: null };
    const { result } = render();
    expect(h.watched.txHash).toBe(EXECUTED_HASH);
    expect(result.current).toMatchObject({
      isSuccess: true,
      isAwaitingOutcome: false,
      txHash: EXECUTED_HASH
    });
  });

  it('watches the returned hash directly outside the Safe App', () => {
    h.safe = { transactionHash: undefined, isSafeApp: false };
    render();
    expect(h.watched.txHash).toBe(SAFE_TX_HASH);
  });

  it('stops awaiting once the transaction fails', () => {
    h.safe = { transactionHash: EXECUTED_HASH, isSafeApp: true };
    h.outcome = { isPending: false, isSuccess: false, failure: new Error('reverted') };
    expect(render().result.current).toMatchObject({ isAwaitingOutcome: false, isSuccess: false });
  });

  it('awaits nothing before a hash is sent', () => {
    h.safe = { transactionHash: undefined, isSafeApp: false };
    const { result } = renderHook(() => useSentTransactionOutcome({}));
    expect(h.watched.txHash).toBeUndefined();
    expect(result.current.isAwaitingOutcome).toBe(false);
  });
});
