import { useMemo } from 'react';
import { useChainId, useConnection, useReadContract } from 'wagmi';
import { Call, erc20Abi } from 'viem';
import { chainId, isTestnetId } from '@jetstreamgg/sky-utils';
import { BatchWriteHook, BatchWriteHookParams } from '../hooks';
import { ZERO_ADDRESS } from '../constants';
import { getWriteContractCall } from '../shared/getWriteContractCall';
import { useTransactionFlow } from '../shared/useTransactionFlow';
import { PENDLE_ROUTER_V4_ABI, PENDLE_ROUTER_V4_ADDRESS } from './constants';
import { buildMaturedRedeemVerifiedArgs } from './buildVerifiedArgs';
import type { PendleMarketConfig } from './pendle';

type UseRedeemParams = BatchWriteHookParams & {
  /** Matured market the user is redeeming from. */
  market: PendleMarketConfig;
  /** Wei amount of PT to burn — typically the user's full balance, since
   *  post-maturity holding earns nothing. */
  ptBalance: bigint;
};

/**
 * Single-market matured-PT redeem via Pendle Router V4 `exitPostExpToToken`.
 *
 * Pipeline:
 *   1. Verify the call args via `buildMaturedRedeemVerifiedArgs` — no API
 *      quote needed; matured redemption is contractually deterministic
 *      (PT → SY 1:1, then SY → underlying at the SY exchange rate).
 *   2. Read the user's PT → Router allowance. If short, prepend an
 *      `erc20.approve(Router, ptBalance)` call.
 *   3. Outer flow (`useTransactionFlow`):
 *        [approve PT?, Router.exitPostExpToToken(...)]
 *      `shouldUseBatch` + supporting wallet → single signature via EIP-5792.
 *      Otherwise sequential. When no approval is needed the call list is
 *      length 1 and `useTransactionFlow` skips the batch path automatically.
 *
 * Pinned-router guard: caller writes to PENDLE_ROUTER_V4_ADDRESS only —
 * never to anything from the API.
 */
export function useRedeem({
  market,
  ptBalance,
  enabled: activeEnabled = true,
  shouldUseBatch = true,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null
}: UseRedeemParams): BatchWriteHook {
  const { address: connectedAddress, isConnected } = useConnection();
  const connectedChainId = useChainId();
  const chainIdToUse = isTestnetId(connectedChainId) ? chainId.tenderly : chainId.mainnet;
  const routerAddress = PENDLE_ROUTER_V4_ADDRESS[chainIdToUse];

  const { data: allowance, error: allowanceError } = useReadContract({
    address: market.ptToken,
    abi: erc20Abi,
    chainId: chainIdToUse,
    functionName: 'allowance',
    args: [connectedAddress || ZERO_ADDRESS, routerAddress],
    query: {
      enabled: !!connectedAddress && ptBalance > 0n
    }
  });

  const { verifiedExit, verifyError } = useMemo(() => {
    if (!connectedAddress || ptBalance === 0n) {
      return { verifiedExit: undefined, verifyError: null as Error | null };
    }
    try {
      return {
        verifiedExit: buildMaturedRedeemVerifiedArgs({
          receiver: connectedAddress,
          market: market.marketAddress,
          ptToken: market.ptToken,
          underlyingToken: market.underlyingToken,
          amountIn: ptBalance
        }),
        verifyError: null
      };
    } catch (e) {
      return { verifiedExit: undefined, verifyError: e as Error };
    }
  }, [connectedAddress, ptBalance, market.marketAddress, market.ptToken, market.underlyingToken]);

  const calls: Call[] = [];
  const needsApproval = ptBalance > 0n && (allowance === undefined || allowance < ptBalance);
  if (needsApproval) {
    calls.push(
      getWriteContractCall({
        to: market.ptToken,
        abi: erc20Abi,
        functionName: 'approve',
        args: [routerAddress, ptBalance]
      })
    );
  }
  if (verifiedExit) {
    calls.push(
      getWriteContractCall({
        to: routerAddress,
        abi: PENDLE_ROUTER_V4_ABI,
        functionName: verifiedExit.functionName,
        args: verifiedExit.args
      })
    );
  }

  const enabled =
    activeEnabled &&
    isConnected &&
    !!verifiedExit &&
    !!routerAddress &&
    ptBalance > 0n &&
    allowance !== undefined;

  const flow = useTransactionFlow({
    calls,
    chainId: chainIdToUse,
    enabled,
    shouldUseBatch,
    onMutate,
    onStart,
    onSuccess,
    onError
  });

  return {
    ...flow,
    error: flow.error || allowanceError || verifyError
  };
}
