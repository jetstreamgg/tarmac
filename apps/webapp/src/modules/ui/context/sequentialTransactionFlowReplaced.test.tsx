import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Call } from 'viem';
import { TransactionReplacedError } from '@/hooks/shared/useTransactionOutcome';

const wagmi = vi.hoisted(() => ({
  onWriteSuccess: undefined as undefined | ((hash: `0x${string}`) => void),
  onRepriced: undefined as undefined | ((from: `0x${string}`, to: `0x${string}`) => void),
  mutationHash: undefined as `0x${string}` | undefined,
  outcome: {
    isPending: false,
    isSuccess: false,
    failure: null as Error | null,
    receipt: undefined as { blockNumber: bigint } | undefined
  }
}));

vi.mock('wagmi', () => ({
  useConnection: () => ({ address: undefined }),
  useSimulateContract: () => ({
    data: { request: { __mock: 'request' } },
    isLoading: false,
    error: null,
    refetch: () => Promise.resolve({})
  }),
  useWriteContract: (opts: { mutation: { onSuccess?: (hash: `0x${string}`) => void } }) => {
    wagmi.onWriteSuccess = opts.mutation.onSuccess;
    return { writeContract: vi.fn(), error: null, data: wagmi.mutationHash, reset: vi.fn() };
  }
}));

vi.mock('@/hooks/shared/useTransactionOutcome', async importOriginal => ({
  ...(await importOriginal<typeof import('@/hooks/shared/useTransactionOutcome')>()),
  useTransactionOutcome: (params: { onRepriced?: typeof wagmi.onRepriced }) => {
    wagmi.onRepriced = params.onRepriced;
    return wagmi.outcome;
  }
}));

vi.mock('@/hooks/shared/useWaitForSafeTxHash', () => ({
  useWaitForSafeTxHash: () => ({ transactionHash: undefined, isSafeApp: false })
}));

import { useSequentialTransactionFlow } from '@/hooks/shared/useSequentialTransactionFlow';

const CLAIM = {
  to: '0x0000000000000000000000000000000000000001',
  abi: [],
  functionName: 'claim',
  args: []
} as unknown as Call;

// Sends the call, then mines it after the wallet replaced it for `reason`.
const mineReplaced = (failOnReplaced: boolean | undefined, reason: string) => {
  const onStart = vi.fn();
  const onSuccess = vi.fn();
  const onError = vi.fn();
  const { result, rerender } = renderHook(() =>
    useSequentialTransactionFlow({ calls: [CLAIM], onStart, onSuccess, onError, failOnReplaced })
  );
  act(() => result.current.execute());
  act(() => {
    wagmi.mutationHash = '0xclaim';
    wagmi.onWriteSuccess?.('0xclaim');
  });
  rerender();
  // viem reports the replacement, then resolves with the replacing tx's receipt.
  act(() => {
    if (reason === 'repriced') wagmi.onRepriced?.('0xclaim', '0xrepriced');
    wagmi.outcome = {
      isPending: false,
      isSuccess: reason === 'repriced',
      failure:
        reason === 'repriced'
          ? null
          : new TransactionReplacedError(new Error(`Transaction ${reason} in the wallet.`)),
      receipt: { blockNumber: 42n }
    };
  });
  rerender();
  return { onStart, onSuccess, onError };
};

describe('useSequentialTransactionFlow, a transaction replaced before it mined', () => {
  beforeEach(() => {
    wagmi.onWriteSuccess = undefined;
    wagmi.onRepriced = undefined;
    wagmi.mutationHash = undefined;
    wagmi.outcome = { isPending: false, isSuccess: false, failure: null, receipt: undefined };
  });

  it.each(['cancelled', 'replaced'])(
    'with failOnReplaced, a %s transaction is an error, never a success',
    reason => {
      const { onSuccess, onError } = mineReplaced(true, reason);
      expect(onSuccess).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(expect.any(TransactionReplacedError), '0xclaim');
    }
  );

  it('with failOnReplaced, a repriced transaction (same call, new fee) succeeds under the hash that mined', () => {
    const { onStart, onSuccess, onError } = mineReplaced(true, 'repriced');
    expect(onStart).toHaveBeenLastCalledWith('0xrepriced');
    expect(onSuccess).toHaveBeenCalledWith('0xrepriced', 42n);
    expect(onError).not.toHaveBeenCalled();
  });

  it('without the option, a repriced transaction succeeds under its first hash as before', () => {
    const { onStart, onSuccess } = mineReplaced(undefined, 'repriced');
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith('0xclaim', 42n);
  });

  it('without the option, a replaced transaction is an error too', () => {
    const { onSuccess, onError } = mineReplaced(undefined, 'cancelled');
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.any(TransactionReplacedError), '0xclaim');
  });
});
