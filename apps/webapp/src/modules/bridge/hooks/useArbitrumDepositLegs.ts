import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAddress, isAddress, type Address } from 'viem';
import { usePublicClient } from 'wagmi';
import { arbitrum } from 'wagmi/chains';
import { useTokenAllowance } from '@/hooks';
import { useSequentialTransactionFlow } from '@/hooks/shared/useSequentialTransactionFlow';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import { retryableQuote } from '../adapters/nativeDeposit/arbitrum';
import { arbitrumDepositCalls, readRetryableEstimates } from '../adapters/nativeDeposit/arbitrumQuote';
import { ARBITRUM_DEPOSIT, L1_USDS } from '../adapters/nativeDeposit/contracts';

export const ARBITRUM_DEPOSIT_FUNCTION = 'outboundTransferCustomRefund';

const toAddress = (value: string | undefined): Address | undefined =>
  value && isAddress(value) ? getAddress(value) : undefined;

/**
 * The source legs of an Ethereum to Arbitrum deposit: the ticket's price,
 * read for this sender, recipient and amount, and the approve (when the
 * allowance is short) and deposit calls built from it. No calls while any read
 * is loading or failed. The callbacks are read through `getCallbacks` so each
 * leg reports to the latest session.
 */
export function useArbitrumDepositLegs({
  enabled,
  chainId,
  account,
  recipient,
  amount,
  getCallbacks
}: {
  enabled: boolean;
  /** The Ethereum chain the deposit is sent on (the Tenderly fork in dev). */
  chainId: number | undefined;
  account: string | undefined;
  /** The Arbitrum recipient; the sender when none was entered. */
  recipient: string | undefined;
  amount: bigint;
  getCallbacks: () => TxCallbacks;
}) {
  const from = toAddress(account);
  const to = toAddress(recipient ?? account);
  const l1 = usePublicClient({ chainId });
  const l2 = usePublicClient({ chainId: arbitrum.id });
  const active = enabled && chainId !== undefined && !!from && !!to && amount > 0n;

  const quote = useQuery({
    queryKey: ['arbitrum-deposit-quote', chainId, from, to, amount.toString()],
    queryFn: async () =>
      retryableQuote(
        await readRetryableEstimates({ l1: l1!, l2: l2!, from: from!, refundTo: to!, recipient: to!, amount })
      ),
    enabled: active && !!l1 && !!l2,
    // Arbitrum's gas price moves: Review keeps a recent one.
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1
  });

  const allowance = useTokenAllowance({
    chainId: chainId ?? 0,
    contractAddress: active ? L1_USDS : undefined,
    owner: from,
    spender: ARBITRUM_DEPOSIT.l1Gateway
  });

  const calls = useMemo(
    () =>
      active && quote.data && allowance.data !== undefined
        ? // Unspent ETH is refunded to the recipient on Arbitrum, as the gateway's own outboundTransfer does.
          arbitrumDepositCalls({
            allowance: allowance.data,
            amount,
            recipient: to!,
            refundTo: to!,
            quote: quote.data
          })
        : [],
    [active, quote.data, allowance.data, amount, to]
  );

  const flow = useSequentialTransactionFlow({
    calls,
    enabled: calls.length > 0,
    chainId,
    failOnReplaced: true,
    onMutate: variables => getCallbacks().onMutate(variables),
    onStart: hash => getCallbacks().onStart(hash),
    onSuccess: (hash, blockNumber) => getCallbacks().onSuccess(hash, blockNumber),
    onError: (error, hash) => getCallbacks().onError(error, hash)
  });

  return {
    calls,
    /** The most ETH the deposit sends for the ticket; the unspent part is refunded on Arbitrum. */
    maxFee: quote.data?.value,
    needsApprove: calls.length > 1,
    /** Confirm can send the first leg. */
    ready: calls.length > 0 && flow.prepared,
    /** A read or the first leg's simulation failed. */
    error: (active && (quote.error ?? allowance.error)) || (calls.length > 0 ? flow.error : null),
    execute: flow.execute,
    reset: flow.reset,
    refetchAllowance: allowance.mutate
  };
}
