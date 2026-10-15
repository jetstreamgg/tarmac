import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAddress, isAddress, type Address } from 'viem';
import { usePublicClient } from 'wagmi';
import { arbitrum } from 'wagmi/chains';
import { useTokenAllowance } from '@/hooks';
import { useDebounce } from '@/hooks/ui/useDebounce';
import { toError, TransactionReplacedError } from '@/hooks/helpers';
import { SAFE_TRANSACTION_SERVICE_URL } from '@/hooks/shared/constants';
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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** The hash a Safe tx executed under, polled like `useWaitForSafeTxHash`: every 2 s up to 150 times (about 5 minutes), while `isWanted`. */
async function safeExecutedHash(chainId: number | undefined, safeTxHash: string, isWanted: () => boolean) {
  const base = chainId === undefined ? undefined : SAFE_TRANSACTION_SERVICE_URL[chainId];
  for (let attempt = 0; base && attempt < 150 && isWanted(); attempt++) {
    try {
      const url = `${base}/api/v1/multisig-transactions/${safeTxHash}/`;
      const data = await (await fetch(url, { signal: AbortSignal.timeout(10_000) })).json();
      if (data.transactionHash) return data.transactionHash as `0x${string}`;
    } catch {
      // Polled again.
    }
    await sleep(2000);
  }
  return undefined;
}

/**
 * The source legs of a native deposit from Ethereum: the approve (when the
 * allowance is short) and the deposit. An Arbitrum deposit also reads its
 * ticket's price for this sender, recipient and amount; an OP Stack deposit
 * needs none. No calls while any read is loading or failed. A deposit prompt
 * signed after its run ended or after a later Confirm reports its hash and
 * any sped-up hash to the callbacks `getCallbacks` returned when it opened,
 * and its receipt while they are still current (inside the Safe App, only
 * once the Safe executes it within about 5 minutes); a late approve or rejection
 * is dropped.
 */
export function useNativeDepositLegs({
  enabled,
  to: network,
  chainId,
  account,
  recipient,
  amount,
  isSafeApp,
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

  // The sender of the run in progress: no other account may sign its later legs.
  const runFromRef = useRef<Address | undefined>(undefined);
  // The run stopped on an error and waits for Retry or a close.
  const pausedRef = useRef(false);
  // The run's deposit is sent (queued, from a Safe): no leg is left to sign, only its receipt to wait for.
  const broadcastRef = useRef(false);
  // The callbacks of the Confirm that opened each wallet prompt, so a prompt signed late reports to its own run.
  const issuersRef = useRef(new WeakMap<object, TxCallbacks>());
  // Read when a late prompt is signed, whichever render opened it.
  const isSafeAppRef = useRef(isSafeApp);
  useLayoutEffect(() => {
    isSafeAppRef.current = isSafeApp;
  });
  // The engine waits only for its run's prompts: a late deposit's receipt reaches its Confirm while the modal follows it.
  const followLate = async (hash: `0x${string}`, issuer: TxCallbacks) => {
    const isFollowed = () => issuer === getCallbacks();
    const onChain = isSafeAppRef.current ? await safeExecutedHash(chainId, hash, isFollowed) : hash;
    if (!onChain || !l1) return;
    let sent = onChain;
    let replaced = false;
    // Retried as the engine's receipt query is: one RPC error is not a failure.
    for (let attempt = 0; ; attempt++) {
      try {
        // No timeout, as the engine's wait: a deposit pending for minutes is not a failure.
        const receipt = await l1.waitForTransactionReceipt({
          hash: sent,
          timeout: 0,
          onReplaced: replacement => {
            if (replacement.reason !== 'repriced') replaced = true;
            else {
              // Its card moves to the new hash even when the modal no longer follows it.
              sent = replacement.transaction.hash;
              issuer.onStart(sent);
            }
          }
        });
        if (!isFollowed()) return;
        if (replaced) issuer.onError(new TransactionReplacedError(), hash);
        else if (receipt.status === 'reverted') issuer.onError(new Error('The transaction reverted.'), sent);
        else issuer.onSuccess(sent, receipt.blockNumber);
        return;
      } catch (error) {
        if (attempt < 3) await sleep(1000 * 2 ** attempt);
        else {
          if (isFollowed()) issuer.onError(toError(error), sent);
          return;
        }
      }
    }
  };
  const flow = useSequentialTransactionFlow({
    calls,
    enabled: calls.length > 0,
    chainId,
    failOnReplaced: true,
    onMutate: variables => {
      pausedRef.current = false;
      if (variables) issuersRef.current.set(variables, getCallbacks());
      getCallbacks().onMutate(variables);
    },
    onStart: (hash, variables) => {
      const issuer = (variables && issuersRef.current.get(variables)) ?? getCallbacks();
      const current = issuer === getCallbacks();
      if (current && runFromRef.current) {
        if (hash && variables?.functionName === nativeDepositFunction(network)) broadcastRef.current = true;
        return issuer.onStart(hash);
      }
      // Signed after its run ended: a deposit is recorded under its own Confirm, an approve is dropped.
      if (variables?.functionName === 'approve') return;
      issuer.onStart(hash);
      if (hash && variables) void followLate(hash as `0x${string}`, issuer);
    },
    onSuccess: (hash, blockNumber) => {
      runFromRef.current = undefined;
      getCallbacks().onSuccess(hash, blockNumber);
    },
    onError: (error, hash, variables) => {
      // A prompt rejected after its run ended, or opened by an earlier Confirm.
      if (!runFromRef.current) return;
      if (variables && issuersRef.current.get(variables) !== getCallbacks()) return;
      pausedRef.current = true;
      getCallbacks().onError(error, hash);
    }
  });

  // The gate polls every minute: read it again before the wallet prompt, so a bridge that just closed costs no gas.
  const checkingRef = useRef(false);
  // Advanced by reset: a switch read that resolves after it sends nothing.
  const runRef = useRef(0);
  const { execute: executeFlow, reset: resetFlow } = flow;
  const reset = useCallback(() => {
    runRef.current += 1;
    checkingRef.current = false;
    runFromRef.current = undefined;
    pausedRef.current = false;
    broadcastRef.current = false;
    resetFlow();
  }, [resetFlow]);
  const execute = useCallback(() => {
    if (checkingRef.current) return;
    if (!l1 || !from) return getCallbacks().onError(new Error('The bridge is not ready to send.'), '');
    checkingRef.current = true;
    const run = runRef.current;
    // Set before the read: a switch while it is pending drops it.
    runFromRef.current = from;
    pausedRef.current = false;
    broadcastRef.current = false;
    const refuse = (error: Error) => {
      pausedRef.current = true;
      getCallbacks().onError(error, '');
    };
    l1.readContract({ address: l1DepositBridge(network), abi: l1BridgeIsOpenAbi, functionName: 'isOpen' })
      .then(
        isOpen => {
          if (run !== runRef.current) return;
          if (isOpen !== 1n) return refuse(new Error('The bridge is closed to new deposits.'));
          executeFlow();
        },
        error => {
          if (run === runRef.current) refuse(toError(error));
        }
      )
      .finally(() => {
        if (run === runRef.current) checkingRef.current = false;
      });
  }, [l1, from, network, executeFlow, getCallbacks]);

  // Ends the run in progress, if any, with `error` unless it is paused on one already.
  const stop = useCallback(
    (error?: Error) => {
      if (!runFromRef.current) return;
      const paused = pausedRef.current;
      reset();
      if (!paused && error) getCallbacks().onError(error, '');
    },
    [reset, getCallbacks]
  );

  const lastFromRef = useRef(from);
  // Another account, or none, ends the run unless it awaits its sent deposit: its later legs would be signed by that account.
  const onAccountChange = useEffectEvent(() => {
    if (from === lastFromRef.current) return;
    lastFromRef.current = from;
    // A cached allowance may predate an approve that mined before the switch.
    if (active) allowance.mutate();
    const runFrom = runFromRef.current;
    if (runFrom && from !== runFrom && (!broadcastRef.current || pausedRef.current))
      stop(new Error('The wallet account changed during the bridge.'));
  });
  useEffect(() => onAccountChange(), [from]);

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
    reset,
    stop,
    refetchAllowance: allowance.mutate
  };
}
