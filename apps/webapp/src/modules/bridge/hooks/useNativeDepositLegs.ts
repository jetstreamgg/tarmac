import { useCallback, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAddress, isAddress, type Address } from 'viem';
import { usePublicClient } from 'wagmi';
import { arbitrum } from 'wagmi/chains';
import { useTokenAllowance } from '@/hooks';
import { useDebounce } from '@/hooks/ui/useDebounce';
import { toError } from '@/hooks/helpers';
import { useSequentialTransactionFlow } from '@/hooks/shared/useSequentialTransactionFlow';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import { retryableQuote } from '../adapters/nativeDeposit/arbitrum';
import { arbitrumDepositCalls, readRetryableEstimates } from '../adapters/nativeDeposit/arbitrumQuote';
import {
  L1_USDS,
  l1BridgeIsOpenAbi,
  l1DepositBridge,
  type NativeDepositNetwork
} from '../adapters/nativeDeposit/contracts';
import { opStackDepositCalls } from '../adapters/nativeDeposit/opStack';

/** The deposit leg's function, which the source recording keys on. */
export const nativeDepositFunction = (to: NativeDepositNetwork) =>
  to === 'arbitrum' ? 'outboundTransferCustomRefund' : 'bridgeERC20To';

const toAddress = (value: string | undefined): Address | undefined =>
  value && isAddress(value) ? getAddress(value) : undefined;

/**
 * The source legs of a native deposit from Ethereum: the approve (when the
 * allowance is short) and the deposit. An Arbitrum deposit also reads its
 * ticket's price for this sender, recipient and amount; an OP Stack deposit
 * needs none. No calls while any read is loading or failed. The callbacks are
 * read through `getCallbacks` so each leg reports to the latest session.
 */
export function useNativeDepositLegs({
  enabled,
  to: network,
  chainId,
  account,
  recipient,
  amount,
  getCallbacks
}: {
  enabled: boolean;
  to: NativeDepositNetwork;
  /** The Ethereum chain the deposit is sent on (the Tenderly fork in dev). */
  chainId: number | undefined;
  account: string | undefined;
  /** The L2 recipient; the sender when none was entered. */
  recipient: string | undefined;
  amount: bigint;
  getCallbacks: () => TxCallbacks;
}) {
  const from = toAddress(account);
  const to = toAddress(recipient ?? account);
  const l1 = usePublicClient({ chainId });
  const l2 = usePublicClient({ chainId: arbitrum.id });
  const active = enabled && chainId !== undefined && !!from && !!to && amount > 0n;
  const isArbitrum = network === 'arbitrum';
  // Priced once typing stops; a price for another amount is never used.
  const quoteAmount = useDebounce(amount);
  const quoteCurrent = quoteAmount === amount;
  // A disabled query still returns its cached result: an OP Stack deposit reads none of it.
  const quote = useQuery({
    queryKey: ['arbitrum-deposit-quote', chainId, from, to, quoteAmount.toString()],
    queryFn: async () =>
      retryableQuote(
        await readRetryableEstimates({ l1: l1!, l2: l2!, from: from!, refundTo: to!, recipient: to!, amount })
      ),
    enabled: active && isArbitrum && quoteCurrent && !!l1 && !!l2,
    // Arbitrum's gas price moves: Review keeps a recent one.
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1
  });

  const allowance = useTokenAllowance({
    chainId: chainId ?? 0,
    contractAddress: active ? L1_USDS : undefined,
    owner: from,
    spender: l1DepositBridge(network)
  });

  const calls = useMemo(() => {
    if (!active || allowance.data === undefined) return [];
    if (!isArbitrum)
      return opStackDepositCalls({ network, allowance: allowance.data, amount, recipient: to! });
    // Unspent ETH is refunded to the recipient on Arbitrum, as the gateway's own outboundTransfer does.
    return quote.data && quoteCurrent
      ? arbitrumDepositCalls({
          allowance: allowance.data,
          amount,
          recipient: to!,
          refundTo: to!,
          quote: quote.data
        })
      : [];
  }, [active, isArbitrum, network, quote.data, quoteCurrent, allowance.data, amount, to]);

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

  // The gate polls every minute: read it again before the wallet prompt, so a bridge that just closed costs no gas.
  const checkingRef = useRef(false);
  const { execute: executeFlow } = flow;
  const execute = useCallback(() => {
    if (checkingRef.current) return;
    if (!l1) return getCallbacks().onError(new Error('The bridge is not ready to send.'), '');
    checkingRef.current = true;
    l1.readContract({ address: l1DepositBridge(network), abi: l1BridgeIsOpenAbi, functionName: 'isOpen' })
      .then(
        isOpen =>
          isOpen === 1n
            ? executeFlow()
            : getCallbacks().onError(new Error('The bridge is closed to new deposits.'), ''),
        error => getCallbacks().onError(toError(error), '')
      )
      .finally(() => {
        checkingRef.current = false;
      });
  }, [l1, network, executeFlow, getCallbacks]);

  return {
    calls,
    /** Arbitrum only: the most ETH the deposit sends for the ticket; the unspent part is refunded on Arbitrum. */
    maxFee: active && isArbitrum && quoteCurrent ? quote.data?.value : undefined,
    needsApprove: calls.length > 1,
    /** Confirm can send the first leg. */
    ready: calls.length > 0 && flow.prepared,
    /** A read or the first leg's simulation failed. */
    error:
      (active && ((isArbitrum && quoteCurrent && quote.error) || allowance.error)) ||
      (calls.length > 0 ? flow.error : null),
    execute,
    reset: flow.reset,
    refetchAllowance: allowance.mutate
  };
}
