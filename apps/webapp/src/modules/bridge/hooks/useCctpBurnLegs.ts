import { useCallback, useMemo, useRef } from 'react';
import { getAddress, isAddress, isAddressEqual, type Address, type Hex, type PublicClient } from 'viem';
import { usePublicClient } from 'wagmi';
import { useTokenAllowance, type TxMutateVariables } from '@/hooks';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import { cctpBurnCalls } from '../adapters/cctp/calls';
import {
  TOKEN_MESSENGER_V2,
  USDS_PER_USDC_UNIT,
  cctpL2Contracts,
  type CctpL2NetworkId
} from '../adapters/cctp/contracts';
import { cctpBurnRefusal, cctpResumeRefusal } from '../adapters/cctp/gate';
import { cctpSwapStore, type UnfinishedCctpSwap } from '../store/cctpSwapStore';
import { isStorageWritable } from '../store/storageWritable';
import { useBridgeCallLegs } from './useBridgeCallLegs';

/** The burn leg, which the source recording keys on. */
export const CCTP_BURN_FUNCTION = 'depositForBurn';
const CCTP_SWAP_FUNCTION = 'swapExactIn';

const toAddress = (value: string | undefined): Address | undefined =>
  value && isAddress(value) ? getAddress(value) : undefined;

/**
 * The source legs of a CCTP bridge from an L2 to Ethereum: approve USDS to
 * PSM3 and USDC to the TokenMessenger when short, the 1:1 swap of the whole
 * amount and the burn of the USDC it returns. A swap sent one leg at a time
 * is kept in `cctpSwapStore` until its burn is sent, so a bridge stopped in
 * between can be continued: with `resume` only that swap's USDC is burned,
 * after the chain shows the swap mined and no burn since. No calls while an
 * allowance is loading or failed, for a recipient CCTP must never mint to,
 * or for another recipient while localStorage can't keep the bridge. The gate
 * is read again on both chains before the wallet prompt, so a paused or
 * drained route costs no gas.
 */
export function useCctpBurnLegs({
  enabled,
  from: network,
  chainId,
  ethereumChainId,
  account,
  recipient,
  amount,
  isSafeApp,
  isSafeWallet,
  batch = false,
  scope,
  resume,
  onCallsSent,
  getCallbacks
}: {
  enabled: boolean;
  from: CctpL2NetworkId;
  /** The L2 the burn is sent on. */
  chainId: number | undefined;
  /** The Ethereum chain the claim is sent on (the Tenderly fork in dev). */
  ethereumChainId: number | undefined;
  account: string | undefined;
  /** The Ethereum recipient; the sender when none was entered. */
  recipient: string | undefined;
  amount: bigint;
  isSafeApp?: boolean;
  /** The account is a Safe by any connector, whose hashes the chain may not confirm. */
  isSafeWallet?: boolean;
  batch?: boolean;
  /** The pending bridges' scope, which a sent swap is kept under. */
  scope?: string;
  /** Continue this bridge: burn the USDC its mined swap returned, to its recipient, and nothing else. */
  resume?: UnfinishedCctpSwap;
  onCallsSent?: (id: string) => void;
  getCallbacks: () => TxCallbacks;
}) {
  const from = toAddress(account);
  const to = toAddress(resume ? resume.recipient : (recipient ?? account));
  const amountIn = resume ? resume.usdcAmount * USDS_PER_USDC_UNIT : amount;
  const swap = !resume;
  const source = usePublicClient({ chainId });
  const destination = usePublicClient({ chainId: ethereumChainId });
  const active = enabled && chainId !== undefined && !!from && !!to && amountIn > 0n;
  const { psm3, usds, usdc } = cctpL2Contracts(network);

  const usdsAllowance = useTokenAllowance({
    chainId: chainId ?? 0,
    contractAddress: active && swap ? usds : undefined,
    owner: from,
    spender: psm3
  });
  const usdcAllowance = useTokenAllowance({
    chainId: chainId ?? 0,
    contractAddress: active ? usdc : undefined,
    owner: from,
    spender: TOKEN_MESSENGER_V2
  });

  const built = useMemo(() => {
    if (!active) return undefined;
    if (resume && resume.network !== network)
      return { error: new Error('This bridge was started on another network.') };
    // Only this browser can bring the recipient the claim link again.
    if (!isAddressEqual(to!, from!) && !isStorageWritable())
      return { error: new Error('Bridging to another address needs browser storage, which is unavailable.') };
    const usdsHeldAllowance = swap ? usdsAllowance.data : 0n;
    if (usdsHeldAllowance === undefined || usdcAllowance.data === undefined) return undefined;
    try {
      return {
        calls: cctpBurnCalls({
          network,
          amount: amountIn,
          account: from!,
          mintRecipient: to!,
          usdsAllowance: usdsHeldAllowance,
          usdcAllowance: usdcAllowance.data,
          swap
        })
      };
    } catch (error) {
      return { error: error as Error };
    }
  }, [active, resume, network, amountIn, from, to, swap, usdsAllowance.data, usdcAllowance.data]);
  const calls = useMemo(() => built?.calls ?? [], [built]);

  const preflight = useCallback(
    async (client: PublicClient) => {
      if (!destination) return new Error('The bridge is not ready to send.');
      if (resume) {
        const refusal = await cctpResumeRefusal({
          network,
          swapTxHash: resume.swapTxHash as Hex,
          account: from!,
          usdcAmount: resume.usdcAmount,
          recipient: resume.recipient as Address,
          client
        });
        if (refusal) return refusal;
      }
      return cctpBurnRefusal({ network, amount: amountIn, source: client, destination, swap });
    },
    [network, amountIn, destination, resume, from, swap]
  );

  // The swap the latest run sent, which its burn clears; the recipient and continued swap it ran for.
  const sentSwapRef = useRef<{ hash: string; variables: TxMutateVariables } | undefined>(undefined);
  const runRef = useRef<{ recipient: Address | undefined; resumed: string | undefined } | undefined>(
    undefined
  );
  // A late callback clears the swap its run continued, not the bridge now on show.
  const resumedSwap = () => (runRef.current ? runRef.current.resumed : resume?.swapTxHash);
  const onLegSent = (hash: string, variables: TxMutateVariables) => {
    // A Safe returns a safeTxHash, which the chain can't confirm a swap by.
    if (!scope || isSafeApp || isSafeWallet) return;
    if (variables.functionName === CCTP_SWAP_FUNCTION) {
      const usdcAmount = (variables as { args?: readonly unknown[] }).args?.[3];
      const swapRecipient = runRef.current?.recipient ?? to;
      if (typeof usdcAmount !== 'bigint' || !swapRecipient) return;
      // A repriced swap comes back with the same variables under the hash that mines.
      const replaced = sentSwapRef.current;
      if (replaced?.variables === variables && replaced.hash !== hash)
        cctpSwapStore.clear(scope, replaced.hash);
      sentSwapRef.current = { hash, variables };
      cctpSwapStore.record(scope, {
        swapTxHash: hash,
        network,
        usdcAmount,
        recipient: swapRecipient,
        at: Date.now()
      });
    } else if (variables.functionName === CCTP_BURN_FUNCTION) {
      const swapTxHash = resumedSwap() ?? sentSwapRef.current?.hash;
      sentSwapRef.current = undefined;
      if (swapTxHash) cctpSwapStore.clear(scope, swapTxHash);
    }
  };
  // A bundle is one prompt, with no onLegSent: a continued swap is dropped once the wallet accepts it.
  const onBundleSent = (id: string) => {
    const resumed = resumedSwap();
    if (scope && resumed) cctpSwapStore.clear(scope, resumed);
    onCallsSent?.(id);
  };
  const legs = useBridgeCallLegs({
    calls,
    chainId,
    client: source,
    from,
    sendFunctionName: CCTP_BURN_FUNCTION,
    preflight,
    isSafeApp,
    batch,
    onCallsSent: onBundleSent,
    // A cached allowance may predate an approve that mined before the switch.
    onAccountSwitch: () => {
      if (!active) return;
      usdsAllowance.mutate();
      usdcAllowance.mutate();
    },
    onLegSent,
    getCallbacks
  });
  const { execute: executeLegs } = legs;
  const execute = useCallback(() => {
    runRef.current = { recipient: to, resumed: resume?.swapTxHash };
    executeLegs();
  }, [to, resume, executeLegs]);

  const { mutate: refetchUsds } = usdsAllowance;
  const { mutate: refetchUsdc } = usdcAllowance;
  const refetchAllowance = useCallback(() => {
    refetchUsds();
    refetchUsdc();
  }, [refetchUsds, refetchUsdc]);

  return {
    calls,
    needsApprove: calls.some(call => (call as { functionName?: string }).functionName === 'approve'),
    isBatch: legs.isBatch,
    ready: legs.ready,
    /** A read, the calls or the first leg's simulation failed. */
    error:
      (active && ((swap && usdsAllowance.error) || usdcAllowance.error)) ||
      built?.error ||
      legs.error ||
      null,
    execute,
    reset: legs.reset,
    stop: legs.stop,
    refetchAllowance
  };
}
