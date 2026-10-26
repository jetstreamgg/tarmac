import { useCallback, useMemo, useRef } from 'react';
import { getAddress, isAddress, type Address, type Hex, type PublicClient } from 'viem';
import { usePublicClient } from 'wagmi';
import { useTokenAllowance, type TxMutateVariables } from '@/hooks';
import { TransactionRefusedError } from '@/hooks/shared/useTransactionOutcome';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import {
  CCTP_CONVERT_FUNCTION,
  CCTP_L2_CONVERT_FUNCTION,
  cctpConvertCalls,
  cctpL2ConvertCalls
} from '../adapters/cctp/calls';
import { L1_USDC, USDS_PSM_WRAPPER, cctpL2Contracts } from '../adapters/cctp/contracts';
import {
  CCTP_SWAP_FAILED_MESSAGE,
  cctpConvertRefusal,
  cctpL2ConvertRefusal,
  cctpResumeRefusal
} from '../adapters/cctp/gate';
import { cctpSwapStore, type UnfinishedCctpSwap } from '../store/cctpSwapStore';
import { isCctpSpendOpen, openCctpSpend } from '../store/openCctpSpends';
import { useBridgeCallLegs } from './useBridgeCallLegs';

export { CCTP_CONVERT_FUNCTION, CCTP_L2_CONVERT_FUNCTION };

const PROMPT_OPEN_MESSAGE = 'Approve or reject the request in your wallet before sending again.';
const SETTLED_MESSAGE = 'This bridge was already sent or converted.';

/** The stopped bridge a convert run is sent for, kept with each of its prompts. */
type ConvertRun = { scope: string; swapTxHash: string };
const isConvertRun = (run: unknown): run is ConvertRun =>
  typeof run === 'object' && run !== null && 'scope' in run && 'swapTxHash' in run;

/**
 * The Ethereum legs that sell `amount` USDC a CCTP claim left in the wallet
 * for USDS to the same account (after an approve when short), one at a time or
 * as one bundle with `batch`. No calls without an amount or while the
 * allowance is loading. The wrapper, liquidity and the USDC balance are read
 * again before the wallet prompt. Only enabled with the wallet on `chainId`.
 * With `swap`, the legs swap that stopped bridge's USDC 1:1 for USDS on its
 * L2's PSM3 instead, only while it is kept under `scope` with no convert sent,
 * no burn or convert prompt for it is open in this tab, and the chain shows
 * its swap mined and no USDC left the wallet since, so USDC held before is
 * never converted. The convert sent is linked to the swap, which hides its
 * card, and unlinked if it reverts or is replaced.
 */
export function useCctpConvertLegs({
  enabled,
  swap,
  scope,
  amount,
  chainId,
  account,
  isSafeApp,
  batch = false,
  getCallbacks
}: {
  enabled: boolean;
  /** The stopped bridge whose USDC is converted on its L2; Ethereum when left out. */
  swap?: UnfinishedCctpSwap;
  /** The pending bridges' scope `swap` is kept under. */
  scope?: string;
  /** USDC, 6 decimals. */
  amount: bigint | undefined;
  /** Ethereum, or the swap's L2 (their Tenderly forks in dev). */
  chainId: number | undefined;
  account: string | undefined;
  isSafeApp?: boolean;
  batch?: boolean;
  getCallbacks: () => TxCallbacks;
}) {
  const from = account && isAddress(account) ? getAddress(account) : undefined;
  const client = usePublicClient({ chainId });
  const network = swap?.network;
  const active = enabled && !!amount && amount > 0n && chainId !== undefined && !!from && (!swap || !!scope);
  const l2 = network ? cctpL2Contracts(network) : undefined;

  const allowance = useTokenAllowance({
    chainId: chainId ?? 0,
    contractAddress: active ? (l2?.usdc ?? L1_USDC) : undefined,
    owner: from,
    spender: l2?.psm3 ?? USDS_PSM_WRAPPER
  });

  const calls = useMemo(() => {
    if (!active || allowance.data === undefined) return [];
    const params = { account: from!, amount: amount!, usdcAllowance: allowance.data };
    return network ? cctpL2ConvertCalls({ network, ...params }) : cctpConvertCalls(params);
  }, [active, network, from, amount, allowance.data]);

  const preflight = useCallback(
    async (reader: PublicClient) => {
      if (!active) return new Error('Nothing to convert.');
      const params = { amount: amount!, account: from!, client: reader };
      if (!swap) return cctpConvertRefusal(params);
      if (isCctpSpendOpen(scope!, swap.swapTxHash)) return new TransactionRefusedError(PROMPT_OPEN_MESSAGE);
      const kept = cctpSwapStore
        .getSnapshot(scope!)
        .find(entry => entry.swapTxHash.toLowerCase() === swap.swapTxHash.toLowerCase());
      if (!kept || kept.convert) return new TransactionRefusedError(SETTLED_MESSAGE, { final: true });
      const refusal = await cctpResumeRefusal({
        network: swap.network,
        swapTxHash: swap.swapTxHash as Hex,
        account: from!,
        usdcAmount: swap.usdcAmount,
        recipient: swap.recipient as Address,
        client: reader
      });
      // Nothing is left to convert: the card goes.
      if (refusal?.message === CCTP_SWAP_FAILED_MESSAGE) cctpSwapStore.clear(scope!, swap.swapTxHash);
      if (refusal) return refusal;
      return cctpL2ConvertRefusal({ network: swap.network, ...params });
    },
    [active, swap, scope, amount, from]
  );
  const isConvertLeg = (variables: TxMutateVariables) => variables.functionName === CCTP_L2_CONVERT_FUNCTION;
  // Each convert sent, by lowercase hash or calls id, with the swap it was linked to.
  const linkedRef = useRef(new Map<string, ConvertRun>());
  const link = (run: unknown, convert: string) => {
    if (!isConvertRun(run)) return;
    cctpSwapStore.markConvert(run.scope, run.swapTxHash, convert);
    linkedRef.current.set(convert.toLowerCase(), run);
  };
  const legs = useBridgeCallLegs({
    calls,
    chainId,
    client,
    from,
    sendFunctionName: network ? CCTP_L2_CONVERT_FUNCTION : CCTP_CONVERT_FUNCTION,
    preflight,
    isSafeApp,
    batch,
    onAccountSwitch: () => {
      if (active) allowance.mutate();
    },
    // A prompt signed late links the swap of the run that opened it, not the one shown now.
    onLegPrompt: (variables, run) =>
      isConvertRun(run) && isConvertLeg(variables) ? openCctpSpend(run.scope, run.swapTxHash) : undefined,
    onLegSent: (hash, variables, run) => {
      if (isConvertLeg(variables)) link(run, hash);
    },
    // A bundle is one prompt, with no onLegSent: the convert is linked to the wallet's calls id.
    onCallsSent: (id, run) => link(run, id),
    onLegFailed: hash => {
      const id = hash.toLowerCase();
      const run = linkedRef.current.get(id);
      if (!run) return;
      linkedRef.current.delete(id);
      const kept = cctpSwapStore
        .getSnapshot(run.scope)
        .find(entry => entry.swapTxHash.toLowerCase() === run.swapTxHash.toLowerCase());
      if (kept?.convert === id) cctpSwapStore.markConvert(run.scope, run.swapTxHash, undefined);
    },
    getCallbacks
  });
  const { execute: executeLegs } = legs;
  const swapTxHash = swap?.swapTxHash;
  const execute = useCallback(
    () => executeLegs(swapTxHash && scope ? ({ scope, swapTxHash } satisfies ConvertRun) : undefined),
    [executeLegs, swapTxHash, scope]
  );

  return {
    calls,
    isBatch: legs.isBatch,
    /** Confirm can send the convert. */
    ready: legs.ready,
    /** The allowance read, or the first leg's simulation, failed. */
    error: (active && allowance.error) || legs.error || null,
    execute,
    reset: legs.reset
  };
}
