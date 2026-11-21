import { useCallback, useMemo } from 'react';
import { getAddress, isAddress, type PublicClient } from 'viem';
import { usePublicClient } from 'wagmi';
import { useTokenAllowance } from '@/hooks';
import type { TxMutateVariables } from '@/hooks';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import { CCTP_CLAIM_FUNCTION, cctpClaimCalls, isCctpClaimOnly } from '../adapters/cctp/calls';
import { cctpClaimMessage } from '../adapters/cctp/cctpProgress';
import { L1_USDC, USDS_PSM_WRAPPER } from '../adapters/cctp/contracts';
import { cctpClaimRefusal } from '../adapters/cctp/gate';
import { useBridgeCallLegs } from './useBridgeCallLegs';

export { CCTP_CLAIM_FUNCTION };

/**
 * The Ethereum legs of a CCTP claim: receive the stored attested message, then
 * sell the minted USDC for USDS to the same account (after an approve when
 * short; not for a claim-only bridge), one at a time or as one bundle with `batch`. No calls while the
 * message doesn't check out, mints to another account or the allowance is
 * loading. The message, pause, sell and liquidity are read again before the
 * wallet prompt. Only enabled with the wallet on `chainId`.
 */
export function useCctpClaimLegs({
  enabled,
  routeData,
  chainId,
  account,
  isSafeApp,
  batch = false,
  batchPending,
  onLegSent,
  onLegFailed,
  onLegPrompt,
  onCallsSent,
  getCallbacks
}: {
  enabled: boolean;
  routeData: Record<string, string> | undefined;
  /** Ethereum (its Tenderly fork in dev). */
  chainId: number | undefined;
  account: string | undefined;
  isSafeApp?: boolean;
  batch?: boolean;
  /** See `useBridgeCallLegs`. */
  batchPending?: boolean;
  /** See `useBridgeCallLegs`: every leg sent, with its run's context, even after the run ended. */
  onLegSent?: (hash: string, variables: TxMutateVariables, context?: unknown) => void;
  /** See `useBridgeCallLegs`: a sent leg reverted or was replaced. */
  onLegFailed?: (hash: string) => void;
  /** See `useBridgeCallLegs`: a leg's wallet prompt opened, with its run's context; returns its release. */
  onLegPrompt?: (variables: TxMutateVariables, context?: unknown) => (() => void) | undefined;
  /** See `useBridgeCallLegs`: the wallet took the bundle, with its run's context. */
  onCallsSent?: (id: string, context?: unknown) => void;
  getCallbacks: () => TxCallbacks;
}) {
  const from = account && isAddress(account) ? getAddress(account) : undefined;
  const client = usePublicClient({ chainId });
  const message = useMemo(() => (enabled ? cctpClaimMessage(routeData) : undefined), [enabled, routeData]);
  const active = !!message && chainId !== undefined && !!from;
  const convert = !isCctpClaimOnly(routeData);

  const allowance = useTokenAllowance({
    chainId: chainId ?? 0,
    contractAddress: active ? L1_USDC : undefined,
    owner: from,
    spender: USDS_PSM_WRAPPER
  });

  const built = useMemo(() => {
    if (!active || allowance.data === undefined) return undefined;
    try {
      return {
        calls: cctpClaimCalls({ ...message, account: from!, usdcAllowance: allowance.data, convert })
      };
    } catch (error) {
      return { error: error as Error };
    }
  }, [active, message, from, allowance.data, convert]);
  const calls = useMemo(() => built?.calls ?? [], [built]);

  const preflight = useCallback(
    async (reader: PublicClient) =>
      message
        ? cctpClaimRefusal({ message: message.message, client: reader })
        : new Error('No claim to send.'),
    [message]
  );
  const legs = useBridgeCallLegs({
    calls,
    chainId,
    client,
    from,
    sendFunctionName: CCTP_CLAIM_FUNCTION,
    preflight,
    isSafeApp,
    batch,
    batchPending,
    onLegSent,
    onLegFailed,
    onLegPrompt,
    onCallsSent,
    onAccountSwitch: () => {
      if (active) allowance.mutate();
    },
    getCallbacks
  });

  const missing = enabled && !message ? new Error('The attested message is missing.') : null;
  return {
    calls,
    isBatch: legs.isBatch,
    /** Confirm can send the claim. */
    ready: legs.ready,
    /** The message, the allowance read, the calls or the first leg's simulation failed. */
    error: missing || (active && allowance.error) || built?.error || legs.error || null,
    execute: legs.execute,
    reset: legs.reset,
    dropCheck: legs.dropCheck,
    /** Ethereum's reader, for what a claim whose sale failed left behind. */
    client
  };
}
