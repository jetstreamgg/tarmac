/**
 * @vitest-environment happy-dom
 */
import { createElement, type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAddress, parseEther } from 'viem';
import { useNativeDepositLegs } from './useNativeDepositLegs';

// Real useNativeDepositLegs + real useSequentialTransactionFlow; only wagmi's I/O is faked.
const SENDER = getAddress('0x71C7656EC7ab88b098defB751B7401B5f6d8976F');
const OTHER = getAddress('0x2546BcD3c84621e976D8185a91A922aE77ECEc30');
const AMOUNT = parseEther('25');
const ESTIMATES = { submissionFee: 510_224_272_976n, gasEstimate: 116_946n, l2GasPrice: 10_000_000n };

const wagmi = vi.hoisted(() => ({
  writeContract: undefined as unknown as ReturnType<typeof import('vitest').vi.fn>,
  onWriteSuccess: undefined as undefined | ((hash: `0x${string}`) => void),
  mutationHash: undefined as `0x${string}` | undefined,
  receipt: { isPending: false, isSuccess: false, failure: null } as {
    isPending: boolean;
    isSuccess: boolean;
    failure: Error | null;
  },
  simulated: [] as string[],
  // The wallet's account, as the engine reads it.
  account: undefined as string | undefined
}));

vi.mock('wagmi', async io => ({
  ...(await io<typeof import('wagmi')>()),
  usePublicClient: ({ chainId }: { chainId?: number }) =>
    chainId === 42161
      ? {
          estimateContractGas: () => Promise.resolve(ESTIMATES.gasEstimate),
          estimateGas: () => Promise.resolve(ESTIMATES.gasEstimate),
          getGasPrice: () => Promise.resolve(ESTIMATES.l2GasPrice)
        }
      : {
          readContract: ({ functionName }: { functionName: string }) =>
            functionName === 'isOpen' ? Promise.resolve(1n) : Promise.resolve(ESTIMATES.submissionFee),
          getBlock: () => Promise.resolve({ baseFeePerGas: 2_000_000_000n })
        },
  // Like wagmi: a disabled simulation with nothing cached for its call has no data and no error.
  useSimulateContract: (params: { functionName?: string; query?: { enabled?: boolean } }) => {
    const enabled = params.query?.enabled !== false && !!params.functionName;
    if (enabled) wagmi.simulated.push(params.functionName!);
    const result = enabled
      ? { data: { request: { functionName: params.functionName } }, isLoading: false, error: null }
      : { data: undefined, isLoading: false, error: null };
    return { ...result, refetch: () => Promise.resolve(result) };
  },
  useWriteContract: (opts: { mutation: { onSuccess?: (hash: `0x${string}`) => void } }) => {
    wagmi.onWriteSuccess = opts.mutation.onSuccess;
    return { writeContract: wagmi.writeContract, error: null, data: wagmi.mutationHash, reset: vi.fn() };
  },
  useConnection: () => ({ address: wagmi.account })
}));
vi.mock('@/hooks/shared/useTransactionOutcome', async io => ({
  ...(await io<typeof import('@/hooks/shared/useTransactionOutcome')>()),
  useTransactionOutcome: () => wagmi.receipt
}));
// The batch engine stays off: these runs are sequential.
vi.mock('@/hooks/shared/useSendBatchTransactionFlow', () => ({
  useSendBatchTransactionFlow: () => ({
    execute: vi.fn(),
    reset: vi.fn(),
    prepared: false,
    isLoading: false,
    error: null,
    currentCallIndex: 0,
    batchUnavailable: false
  })
}));
vi.mock('@/hooks/shared/useWaitForSafeTxHash', () => ({
  useWaitForSafeTxHash: () => ({ transactionHash: undefined, isSafeApp: false })
}));
vi.mock('@/hooks', () => ({
  useTokenAllowance: (args: { contractAddress?: string }) => ({
    data: args.contractAddress ? 0n : undefined,
    error: null,
    mutate: vi.fn()
  })
}));

const callbacks = { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: vi.fn() };

const settle = async () => {
  for (let i = 0; i < 5; i++) await act(() => new Promise(resolve => setTimeout(resolve, 0)));
};

type Props = { account: string | undefined };

describe('a started Arbitrum deposit when the wallet account changes after the approve was signed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wagmi.writeContract = vi.fn();
    wagmi.onWriteSuccess = undefined;
    wagmi.mutationHash = undefined;
    wagmi.receipt = { isPending: false, isSuccess: false, failure: null };
    wagmi.simulated = [];
  });

  it.each([
    ['stays connected (control)', SENDER, true],
    ['switches to another account', OTHER, false],
    ['disconnects', undefined, false]
  ])(
    'wallet %s: the deposit leg goes out only from the sender, otherwise the run fails once; never hangs',
    async (_, after, sends) => {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const wrapper = ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client: queryClient }, children);
      const { result, rerender } = renderHook(
        ({ account }: Props) => {
          wagmi.account = account;
          return useNativeDepositLegs({
            enabled: true,
            to: 'arbitrum',
            chainId: 1,
            account,
            recipient: undefined,
            amount: AMOUNT,
            getCallbacks: () => callbacks
          });
        },
        { wrapper, initialProps: { account: SENDER } as Props }
      );
      await settle();
      expect(result.current.calls.map(call => call.functionName)).toEqual([
        'approve',
        'outboundTransferCustomRefund'
      ]);
      expect(result.current.ready).toBe(true);

      // Confirm: the switch read passes, the approve is signed.
      act(() => result.current.execute());
      await waitFor(() => expect(wagmi.writeContract).toHaveBeenCalledTimes(1));
      expect(wagmi.writeContract.mock.calls[0][0]).toMatchObject({ functionName: 'approve' });
      act(() => {
        wagmi.mutationHash = '0xapprove';
        wagmi.onWriteSuccess?.('0xapprove');
      });
      rerender({ account: SENDER });

      // The wallet disconnects while the approve is mining: the live calls empty.
      rerender({ account: after });
      if (!after) expect(result.current.calls).toEqual([]);

      // The approve mines.
      act(() => {
        wagmi.receipt = { isPending: false, isSuccess: true, failure: null };
      });
      rerender({ account: after });
      act(() => {
        wagmi.receipt = { isPending: false, isSuccess: false, failure: null };
      });
      rerender({ account: after });
      await settle();

      // Invariant: the deposit leg goes out only while the sender is connected, and a run that can't send fails once.
      const depositSent = () =>
        wagmi.writeContract.mock.calls.some(
          ([request]) =>
            (request as { functionName?: string }).functionName === 'outboundTransferCustomRefund'
        );
      if (sends) await waitFor(() => expect(depositSent()).toBe(true), { timeout: 2000 });
      else await waitFor(() => expect(callbacks.onError).toHaveBeenCalled(), { timeout: 2000 });
      await settle();
      expect({ depositSent: depositSent(), errors: callbacks.onError.mock.calls.length }).toEqual({
        depositSent: sends,
        errors: sends ? 0 : 1
      });
    }
  );
});
