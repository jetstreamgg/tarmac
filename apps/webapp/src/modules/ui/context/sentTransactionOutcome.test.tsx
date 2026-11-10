import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// APP-567: the outcome both engines settle on, for a hash a Safe may have returned.

type Safe = {
  transactionHash?: `0x${string}`;
  failure: Error | null;
  failureHash?: `0x${string}`;
  isSafeWallet: boolean;
  chainId?: number;
};

const h = vi.hoisted(() => ({
  safe: { failure: null, isSafeWallet: true } as Safe,
  outcome: { isPending: false, isSuccess: false, failure: null as Error | null },
  watched: {} as { hash?: string; chainId?: number }
}));

vi.mock('@/hooks/shared/useTransactionOutcome', () => ({
  useTransactionOutcome: (watched: { hash?: string; chainId?: number }) => {
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

const render = () => renderHook(() => useSentTransactionOutcome({ hash: SAFE_TX_HASH }));

beforeEach(() => {
  h.safe = { failure: null, isSafeWallet: true };
  h.outcome = { isPending: false, isSuccess: false, failure: null };
});

describe('useSentTransactionOutcome', () => {
  it('waits on a queued safeTxHash without watching it on-chain', () => {
    const { result } = render();
    expect(h.watched.hash).toBeUndefined();
    expect(result.current).toMatchObject({ isAwaitingOutcome: true, settleHash: undefined });
  });

  it('settles on the executed hash, watched on the chain the Safe pinned', () => {
    h.safe = { transactionHash: EXECUTED_HASH, failure: null, isSafeWallet: true, chainId: 8453 };
    h.outcome = { isPending: false, isSuccess: true, failure: null };
    const { result } = render();
    expect(h.watched).toEqual({ hash: EXECUTED_HASH, chainId: 8453 });
    expect(result.current).toMatchObject({ isSuccess: true, settleHash: EXECUTED_HASH });
  });

  it('settles a rejection on the safeTxHash and a failed execution on its on-chain hash', () => {
    h.safe = { failure: new Error('rejected'), isSafeWallet: true };
    expect(render().result.current).toMatchObject({ isSuccess: false, settleHash: SAFE_TX_HASH });

    h.safe = { failure: new Error('reverted'), failureHash: EXECUTED_HASH, isSafeWallet: true };
    expect(render().result.current).toMatchObject({ isSuccess: false, settleHash: EXECUTED_HASH });
  });

  it('watches the returned hash directly for a wallet that is not a Safe', () => {
    h.safe = { failure: null, isSafeWallet: false };
    render();
    expect(h.watched.hash).toBe(SAFE_TX_HASH);
  });

  // A slow Safe probe must not reopen an outcome already reported on the returned hash.
  it('keeps a settled outcome when the Safe probe answers late', () => {
    h.safe = { failure: null, isSafeWallet: false };
    h.outcome = { isPending: false, isSuccess: true, failure: null };
    const { result, rerender } = render();

    h.safe = { failure: null, isSafeWallet: true };
    rerender();

    expect(h.watched.hash).toBe(SAFE_TX_HASH);
    expect(result.current).toMatchObject({ isSuccess: true, settleHash: SAFE_TX_HASH });
  });
});
