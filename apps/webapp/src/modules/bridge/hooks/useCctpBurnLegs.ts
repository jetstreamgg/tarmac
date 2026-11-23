import { useCallback, useMemo, useRef } from 'react';
import { isAddressEqual, type Address, type PublicClient } from 'viem';
import { usePublicClient } from 'wagmi';
import { useTokenAllowance, type TxMutateVariables } from '@/hooks';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import { math } from '@/utils';
import { cctpBurnCalls } from '../adapters/cctp/calls';
import { TOKEN_MESSENGER_V2, cctpL2Contracts, type CctpL2NetworkId } from '../adapters/cctp/contracts';
import { cctpBurnRefusal } from '../adapters/cctp/gate';
import { cctpSwapStore, isBurnOf, type UnfinishedCctpSwap } from '../store/cctpSwapStore';
import { pendingBridgeStore } from '../store/pendingStore';
import { openCctpSpend } from '../store/openCctpSpends';
import { isStorageWritable } from '../store/storageWritable';
import { unfinishedSwapRefusal } from '../store/unfinishedSwapRefusal';
import { useBridgeCallLegs } from './useBridgeCallLegs';
import { toAddress } from '../model/recipient';

/** The burn leg, which the source recording keys on. */
export const CCTP_BURN_FUNCTION = 'depositForBurn';
const CCTP_SWAP_FUNCTION = 'swapExactIn';
const STORAGE_REFUSED_MESSAGE = 'Bridging to another address needs browser storage, which is unavailable.';

/**
 * The source legs of a CCTP bridge from an L2 to Ethereum: approve USDS to
 * PSM3 and USDC to the TokenMessenger when short, the 1:1 swap of the whole
 * amount and the burn of the USDC it returns. A swap sent one leg at a time
 * is kept in `cctpSwapStore`, linked to the burn last sent for it, until that
 * burn mines, so a bridge stopped in between or whose burn failed can be
 * continued: with `resume` only that swap's USDC is burned, after the chain
 * shows the swap mined and no burn since, and no burn or convert prompt for it is open in this tab. A swap seen to revert, while mounted or by Continue, is dropped. No calls while an
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
  batchPending,
  scope,
  resume,
  storageWritable,
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
  /** See `useBridgeCallLegs`. */
  batchPending?: boolean;
  /** The pending bridges' scope, which a sent swap is kept under. */
  scope?: string;
  /** Continue this bridge: burn the USDC its mined swap returned, to its recipient, and nothing else. */
  resume?: UnfinishedCctpSwap;
  /** Whether localStorage takes writes, as the Review last probed it; probed here when not given. */
  storageWritable?: boolean;
  onCallsSent?: (id: string) => void;
  getCallbacks: () => TxCallbacks;
}) {
  const from = toAddress(account);
  const to = toAddress(resume ? resume.recipient : (recipient ?? account));
  const amountIn = resume ? math.convertUSDCtoWad(resume.usdcAmount) : amount;
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
    const writable = storageWritable ?? isStorageWritable();
    if (resume && resume.network !== network)
      return { error: new Error('This bridge was started on another network.') };
    // Only this browser can bring the recipient the claim link again.
    if (!isAddressEqual(to!, from!) && !writable) return { error: new Error(STORAGE_REFUSED_MESSAGE) };
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
  }, [
    active,
    resume,
    network,
    amountIn,
    from,
    to,
    swap,
    storageWritable,
    usdsAllowance.data,
    usdcAllowance.data
  ]);
  const calls = useMemo(() => built?.calls ?? [], [built]);

  const preflight = useCallback(
    async (client: PublicClient, nextCalls: readonly unknown[] = calls) => {
      if (!destination) return new Error('The bridge is not ready to send.');
      // Storage may have stopped taking writes since the Review.
      if (to && from && !isAddressEqual(to, from) && !isStorageWritable())
        return new Error(STORAGE_REFUSED_MESSAGE);
      if (resume) {
        const refusal = await unfinishedSwapRefusal({ scope, swap: resume, account: from!, client });
        if (refusal) return refusal;
      }
      // A Retry after the run's swap mined needs no USDC from PSM3.
      const swapLeft =
        swap &&
        nextCalls.some(call => (call as { functionName?: string }).functionName === CCTP_SWAP_FUNCTION);
      return cctpBurnRefusal({ network, amount: amountIn, source: client, destination, swap: swapLeft });
    },
    [network, amountIn, destination, resume, from, to, swap, scope, calls]
  );

  // Fixed per run at Confirm: the status a leg is later sent under may read unsettled.
  const isSafe = !!isSafeApp || !!isSafeWallet;
  // The network, recipient, continued swap and Safe-ness a run was executed for, and the swap it sent, which its burn is linked to.
  type Run = {
    network: CctpL2NetworkId;
    recipient: Address | undefined;
    resumed: string | undefined;
    safe: boolean;
    sentSwap?: { hash: string; variables: TxMutateVariables };
  };
  // The latest run executed, for a callback that comes with no context; the engine may have refused it.
  const runRef = useRef<Run | undefined>(undefined);
  // A new burn retries the swap's last one: that one's Failed card goes (Activity keeps it).
  const linkBurn = (scope: string, swapTxHash: string, burn: string) => {
    const replaced = cctpSwapStore.markBurn(scope, swapTxHash, burn);
    const failed =
      replaced &&
      pendingBridgeStore
        .getSnapshot(scope)
        .find(bridge => bridge.status === 'failed' && isBurnOf(bridge, replaced));
    if (failed) pendingBridgeStore.close(scope, failed.id);
  };
  const onLegSent = (hash: string, variables: TxMutateVariables, context?: unknown) => {
    if (!scope) return;
    // The run whose prompt this leg was signed in, though another run may have started since.
    const run = (context as Run | undefined) ?? runRef.current;
    if (!run) return;
    // A Safe returns a safeTxHash, which the chain can't confirm a swap by.
    if (run.safe) return;
    if (variables.functionName === CCTP_SWAP_FUNCTION) {
      const usdcAmount = (variables as { args?: readonly unknown[] }).args?.[3];
      if (typeof usdcAmount !== 'bigint' || !run.recipient) return;
      // A repriced swap comes back with the same variables under the hash that mines.
      const replaced = run.sentSwap;
      if (replaced?.variables === variables && replaced.hash !== hash)
        cctpSwapStore.clear(scope, replaced.hash);
      run.sentSwap = { hash, variables };
      cctpSwapStore.record(scope, {
        swapTxHash: hash,
        network: run.network,
        usdcAmount,
        recipient: run.recipient,
        at: Date.now()
      });
    } else if (variables.functionName === CCTP_BURN_FUNCTION) {
      // Kept until the burn mines: a burn that reverts leaves the USDC to continue.
      const swapTxHash = run.resumed ?? run.sentSwap?.hash;
      if (swapTxHash) linkBurn(scope, swapTxHash, hash);
    }
  };
  const onLegPrompt = (variables: TxMutateVariables, context?: unknown) => {
    if (!scope || variables.functionName !== CCTP_BURN_FUNCTION) return undefined;
    const run = (context as Run | undefined) ?? runRef.current;
    const swapTxHash = run?.resumed ?? run?.sentSwap?.hash;
    return swapTxHash ? openCctpSpend(scope, swapTxHash) : undefined;
  };
  // A bundle is one prompt, with no onLegSent: the swap its run continued is linked to the wallet's calls id.
  const onBundleSent = (id: string, context?: unknown) => {
    const run = (context as Run | undefined) ?? runRef.current;
    const resumed = run ? run.resumed : resume?.swapTxHash;
    if (scope && resumed) linkBurn(scope, resumed, id);
    onCallsSent?.(id);
  };
  // A swap whose receipt reverted, or that was replaced, swapped nothing; any other hash is no swap.
  const onLegFailed = (hash: string) => {
    if (scope) cctpSwapStore.clear(scope, hash);
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
    batchPending,
    onCallsSent: onBundleSent,
    // A cached allowance may predate an approve that mined before the switch.
    onAccountSwitch: () => {
      if (!active) return;
      usdsAllowance.mutate();
      usdcAllowance.mutate();
    },
    onLegSent,
    onLegPrompt,
    onLegFailed,
    getCallbacks
  });
  const { execute: executeLegs } = legs;
  const execute = useCallback(() => {
    // Try again resumes the last run's legs, so its burn still belongs to the swap that run sent.
    const last = runRef.current;
    const sentSwap =
      last && last.network === network && last.recipient === to && last.resumed === resume?.swapTxHash
        ? last.sentSwap
        : undefined;
    const run: Run = { network, recipient: to, resumed: resume?.swapTxHash, safe: isSafe, sentSwap };
    runRef.current = run;
    executeLegs(run);
  }, [network, to, resume, isSafe, executeLegs]);

  const { mutate: refetchUsds } = usdsAllowance;
  const { mutate: refetchUsdc } = usdcAllowance;
  const refetchAllowance = useCallback(() => {
    refetchUsds();
    refetchUsdc();
  }, [refetchUsds, refetchUsdc]);

  return {
    calls,
    isBatch: legs.isBatch,
    ready: legs.ready,
    /** A leg of the last run is still out, after a close. */
    busy: legs.busy,
    /** A leg of this run mined: Retry resumes the rest. */
    legMined: legs.legMined,
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
