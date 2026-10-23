import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAddress, isAddress, type Address, type PublicClient } from 'viem';
import { usePublicClient } from 'wagmi';
import { arbitrum } from 'wagmi/chains';
import { useTokenAllowance } from '@/hooks';
import { useDebounce } from '@/hooks/ui/useDebounce';
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
import { useBridgeCallLegs } from './useBridgeCallLegs';

/** The deposit leg's function, which the source recording keys on. */
export const nativeDepositFunction = (to: NativeDepositNetwork) =>
  to === 'arbitrum' ? 'outboundTransferCustomRefund' : 'bridgeERC20To';

const toAddress = (value: string | undefined): Address | undefined =>
  value && isAddress(value) ? getAddress(value) : undefined;

/**
 * The source legs of a native deposit from Ethereum: the approve (when the
 * allowance is short) and the deposit. An Arbitrum deposit also reads its
 * ticket's price for this sender, recipient and amount; an OP Stack deposit
 * needs none. No calls while any read is loading or failed. A deposit prompt
 * signed after its run ended or after a later Confirm reports its hash and
 * any sped-up hash to the callbacks `getCallbacks` returned when it opened,
 * and its receipt while they are still current (inside the Safe App, only
 * once the Safe executes it within about 5 minutes); a late approve or rejection
 * is dropped. With `batch`, the approve and the deposit go out as one atomic
 * wallet bundle; a bundle accepted late reports to its own Confirm, and its
 * verdict only while that Confirm is current. No send starts while the wallet
 * shows a bundle for the same account, opened from any form.
 */
export function useNativeDepositLegs({
  enabled,
  to: network,
  chainId,
  account,
  recipient,
  amount,
  isSafeApp,
  batch = false,
  onCallsSent,
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
  /** Inside the Safe App a signed prompt returns a safeTxHash. */
  isSafeApp?: boolean;
  /** Bundle the legs when the wallet can: the user's batch setting, never for a Safe. */
  batch?: boolean;
  /** The wallet accepted a bundle under this EIP-5792 id; called right before its `onStart`. */
  onCallsSent?: (id: string) => void;
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

  const preflight = useCallback(
    async (client: PublicClient) =>
      (await client.readContract({
        address: l1DepositBridge(network),
        abi: l1BridgeIsOpenAbi,
        functionName: 'isOpen'
      })) === 1n
        ? undefined
        : new Error('The bridge is closed to new deposits.'),
    [network]
  );
  const legs = useBridgeCallLegs({
    calls,
    chainId,
    client: l1,
    from,
    sendFunctionName: nativeDepositFunction(network),
    preflight,
    isSafeApp,
    batch,
    onCallsSent: id => onCallsSent?.(id),
    // A cached allowance may predate an approve that mined before the switch.
    onAccountSwitch: () => {
      if (active) allowance.mutate();
    },
    getCallbacks
  });

  return {
    calls,
    /** Arbitrum only: the most ETH the deposit sends for the ticket; the unspent part is refunded on Arbitrum. */
    maxFee: active && isArbitrum && quoteCurrent ? quote.data?.value : undefined,
    needsApprove: calls.length > 1,
    /** The legs go out as one wallet bundle. */
    isBatch: legs.isBatch,
    /** Confirm can send the first leg. */
    ready: legs.ready,
    /** A leg of the last run is still out, after a close. */
    busy: legs.busy,
    /** A read or the first leg's simulation failed. */
    error: (active && ((isArbitrum && quoteCurrent && quote.error) || allowance.error)) || legs.error,
    execute: legs.execute,
    reset: legs.reset,
    stop: legs.stop,
    refetchAllowance: allowance.mutate
  };
}
