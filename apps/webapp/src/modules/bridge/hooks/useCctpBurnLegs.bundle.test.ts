/**
 * @vitest-environment happy-dom
 */
// A bundle the wallet accepts clears the swap its own run continued, not one of a Confirm the engine refused.
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TransactionRefusedError } from '@/hooks/shared/useTransactionOutcome';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import { BASE_BURN_AMOUNT, BASE_BURN_MINT_RECIPIENT, BASE_BURN_TX } from '../adapters/cctp/cctpFixtures';
import { useCctpBurnLegs } from './useCctpBurnLegs';

type BatchArgs = { onMutate: () => void; onCallsSent: (id: string) => void; onStart: () => void };

const mocks = vi.hoisted(() => ({
  batch: [] as BatchArgs[],
  record: vi.fn(),
  clear: vi.fn()
}));

vi.mock('wagmi', () => ({ usePublicClient: ({ chainId }: { chainId?: number }) => ({ chainId }) }));
vi.mock('@/hooks', () => ({
  useTokenAllowance: (params: Record<string, unknown>) => ({
    data: params.contractAddress ? 0n : undefined,
    error: null,
    mutate: vi.fn()
  })
}));
vi.mock('../adapters/cctp/gate', () => ({
  cctpBurnRefusal: async () => undefined,
  cctpResumeRefusal: async () => undefined
}));
vi.mock('../store/cctpSwapStore', () => ({ cctpSwapStore: { record: mocks.record, clear: mocks.clear } }));
vi.mock('../store/storageWritable', () => ({ isStorageWritable: () => true }));
// The wallet opens the bundle on execute.
vi.mock('@/hooks/shared/useSendBatchTransactionFlow', () => ({
  useSendBatchTransactionFlow: (args: BatchArgs) => {
    mocks.batch.push(args);
    return {
      execute: () => mocks.batch.at(-1)!.onMutate(),
      reset: vi.fn(),
      prepared: true,
      isLoading: false,
      error: null,
      currentCallIndex: 0,
      batchUnavailable: false
    };
  }
}));
vi.mock('@/hooks/shared/useSequentialTransactionFlow', () => ({
  useSequentialTransactionFlow: () => ({ prepared: true, error: null, execute: vi.fn(), reset: vi.fn() })
}));

const SCOPE = 'scope';
const X = '0x' + 'ab'.repeat(32);
const Y = '0x' + '12'.repeat(32);
const RESUME_X = {
  swapTxHash: X,
  network: 'base' as const,
  usdcAmount: BASE_BURN_AMOUNT,
  recipient: BASE_BURN_MINT_RECIPIENT.toLowerCase(),
  at: 0
};
const RESUME_Y = { ...RESUME_X, swapTxHash: Y };
const callbacks = { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: vi.fn() };

const renderLegs = () =>
  renderHook(
    ({ resume }: { resume: typeof RESUME_X }) =>
      useCctpBurnLegs({
        enabled: true,
        from: 'base',
        chainId: 8453,
        ethereumChainId: 1,
        account: BASE_BURN_TX.from,
        recipient: undefined,
        amount: 0n,
        batch: true,
        scope: SCOPE,
        resume,
        getCallbacks: () => callbacks as TxCallbacks
      }),
    { initialProps: { resume: RESUME_X } }
  );

describe('useCctpBurnLegs with a bundle accepted after a later Confirm was refused', () => {
  afterEach(() => {
    mocks.batch = [];
    vi.clearAllMocks();
  });

  it('clears the swap the accepted bundle continued and keeps the refused one', async () => {
    const { result, rerender } = renderLegs();
    // Continue X: its approve and burn bundle opens in the wallet, and the modal closes on it.
    await act(async () => result.current.execute());
    act(() => result.current.reset());

    // Continue Y while the wallet still shows X's bundle: refused, nothing sent.
    rerender({ resume: RESUME_Y });
    await act(async () => result.current.execute());
    expect(callbacks.onError).toHaveBeenCalledWith(expect.any(TransactionRefusedError), '');

    // The wallet accepts X's bundle.
    act(() => {
      mocks.batch.at(-1)!.onCallsSent('0xcalls');
      mocks.batch.at(-1)!.onStart();
    });

    expect(mocks.clear).not.toHaveBeenCalledWith(SCOPE, Y);
    expect(mocks.clear).toHaveBeenCalledWith(SCOPE, X);
  });
});
