import { useCallback, useMemo } from 'react';
import { getAddress, isAddress, type PublicClient } from 'viem';
import { usePublicClient } from 'wagmi';
import { useTokenAllowance } from '@/hooks';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import { CCTP_CONVERT_FUNCTION, cctpConvertCalls } from '../adapters/cctp/calls';
import { L1_USDC, USDS_PSM_WRAPPER } from '../adapters/cctp/contracts';
import { cctpConvertRefusal } from '../adapters/cctp/gate';
import { useBridgeCallLegs } from './useBridgeCallLegs';

export { CCTP_CONVERT_FUNCTION };

/**
 * The Ethereum legs that sell `amount` USDC a CCTP claim left in the wallet
 * for USDS to the same account (after an approve when short), one at a time or
 * as one bundle with `batch`. No calls without an amount or while the
 * allowance is loading. The wrapper, liquidity and the USDC balance are read
 * again before the wallet prompt. Only enabled with the wallet on `chainId`.
 */
export function useCctpConvertLegs({
  enabled,
  amount,
  chainId,
  account,
  isSafeApp,
  batch = false,
  getCallbacks
}: {
  enabled: boolean;
  /** USDC, 6 decimals. */
  amount: bigint | undefined;
  /** Ethereum (its Tenderly fork in dev). */
  chainId: number | undefined;
  account: string | undefined;
  isSafeApp?: boolean;
  batch?: boolean;
  getCallbacks: () => TxCallbacks;
}) {
  const from = account && isAddress(account) ? getAddress(account) : undefined;
  const client = usePublicClient({ chainId });
  const active = enabled && !!amount && amount > 0n && chainId !== undefined && !!from;

  const allowance = useTokenAllowance({
    chainId: chainId ?? 0,
    contractAddress: active ? L1_USDC : undefined,
    owner: from,
    spender: USDS_PSM_WRAPPER
  });

  const calls = useMemo(
    () =>
      active && allowance.data !== undefined
        ? cctpConvertCalls({ account: from!, amount: amount!, usdcAllowance: allowance.data })
        : [],
    [active, from, amount, allowance.data]
  );

  const preflight = useCallback(
    async (reader: PublicClient) =>
      active
        ? cctpConvertRefusal({ amount: amount!, account: from!, client: reader })
        : new Error('Nothing to convert.'),
    [active, amount, from]
  );
  const legs = useBridgeCallLegs({
    calls,
    chainId,
    client,
    from,
    sendFunctionName: CCTP_CONVERT_FUNCTION,
    preflight,
    isSafeApp,
    batch,
    onAccountSwitch: () => {
      if (active) allowance.mutate();
    },
    getCallbacks
  });

  return {
    calls,
    isBatch: legs.isBatch,
    /** Confirm can send the convert. */
    ready: legs.ready,
    /** The allowance read, or the first leg's simulation, failed. */
    error: (active && allowance.error) || legs.error || null,
    execute: legs.execute,
    reset: legs.reset
  };
}
