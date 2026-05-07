import { useMemo } from 'react';
import { useChainId, useConnection, useReadContracts } from 'wagmi';
import { Call, erc20Abi } from 'viem';
import { chainId, isTestnetId } from '@jetstreamgg/sky-utils';
import { BatchWriteHook, BatchWriteHookParams } from '../hooks';
import { ZERO_ADDRESS } from '../constants';
import { getWriteContractCall } from '../shared/getWriteContractCall';
import { useTransactionFlow } from '../shared/useTransactionFlow';
import { PENDLE_ROUTER_V4_ABI, PENDLE_ROUTER_V4_ADDRESS } from './constants';
import {
  buildMaturedRedeemVerifiedArgs,
  buildMulticallVerifiedArgs,
  type VerifiedCall
} from './buildVerifiedArgs';
import type { PendleMarketConfig } from './pendle';

/**
 * One matured position the user wants to redeem in this batch.
 * `ptBalance` is the wei amount of PT to burn — typically the user's full
 * balance, since post-maturity holding earns nothing.
 */
export type RedeemPosition = {
  market: PendleMarketConfig;
  ptBalance: bigint;
};

type UseBatchPendleRedeemMulticallParams = BatchWriteHookParams & {
  /** Stable-ordered list of matured positions to redeem in one tx */
  positions: RedeemPosition[];
};

/**
 * Multi-market matured-PT redeem in a single signature (EIP-5792-batched).
 *
 * Pipeline:
 *   1. For each position, derive a `VerifiedExitArgs` via
 *      `buildMaturedRedeemVerifiedArgs` (no API quote needed — matured
 *      redemption is contractually 1:1).
 *   2. Wrap the N inner calls into a single Pendle Router
 *      `multicall(bytes[])` call via `buildMulticallVerifiedArgs`.
 *   3. Compute per-PT-token allowances to the Router. Any PT lacking
 *      sufficient allowance gets a prepended `erc20.approve(Router, ptBalance)`
 *      call in the EIP-5792 batch.
 *   4. Outer batch (EIP-5792 / wagmi `useTransactionFlow`):
 *        [approve PT1?, approve PT2?, …, Router.multicall([exit1, exit2, …])]
 *      Wallet supporting EIP-5792 → single signature. Sequential fallback
 *      otherwise.
 *
 * Pinned-router guard: caller pins to PENDLE_ROUTER_V4_ADDRESS via
 * `useTransactionFlow` — never to anything from the API.
 *
 * Atomicity: the inner multicall is atomic (all exits succeed or none do).
 * The outer EIP-5792 batch is atomic on supporting wallets but sequential on
 * fallback — partial-success recoverable; the user can re-run with the
 * remaining markets.
 */
export function useBatchPendleRedeemAll({
  positions,
  enabled: activeEnabled = true,
  shouldUseBatch = true,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null
}: UseBatchPendleRedeemMulticallParams): BatchWriteHook {
  const { address: connectedAddress, isConnected } = useConnection();
  const connectedChainId = useChainId();
  const chainIdToUse = isTestnetId(connectedChainId) ? chainId.tenderly : chainId.mainnet;
  const routerAddress = PENDLE_ROUTER_V4_ADDRESS[chainIdToUse];

  // Batched allowance reads — one per PT token in the redeem set.
  const { data: allowances, error: allowanceError } = useReadContracts({
    contracts: positions.map(p => ({
      address: p.market.ptToken,
      abi: erc20Abi,
      chainId: chainIdToUse,
      functionName: 'allowance' as const,
      args: [connectedAddress || ZERO_ADDRESS, routerAddress] as const
    })),
    query: {
      enabled: !!connectedAddress && positions.length > 0
    }
  });

  // Verify each position and build the multicall wrapper. Memoised so the
  // verification only re-runs when the position set changes.
  const { verifiedMulticall, verifyError } = useMemo(() => {
    if (!connectedAddress || positions.length === 0) {
      return { verifiedMulticall: undefined, verifyError: null as Error | null };
    }
    try {
      const inner: VerifiedCall[] = positions
        .filter(p => p.ptBalance > 0n)
        .map(p =>
          buildMaturedRedeemVerifiedArgs({
            receiver: connectedAddress,
            market: p.market.marketAddress,
            ptToken: p.market.ptToken,
            underlyingToken: p.market.underlyingToken,
            amountIn: p.ptBalance
          })
        );
      if (inner.length === 0) {
        return {
          verifiedMulticall: undefined,
          verifyError: new Error('Pendle: no positions with non-zero PT balance to redeem')
        };
      }
      return { verifiedMulticall: buildMulticallVerifiedArgs(inner), verifyError: null };
    } catch (e) {
      return { verifiedMulticall: undefined, verifyError: e as Error };
    }
  }, [positions, connectedAddress]);

  // Build the call list: prepend an approve per PT token that lacks it,
  // then the outer Router.multicall. EIP-5792-capable wallets bundle this
  // into one signature.
  const calls: Call[] = [];
  positions.forEach((p, i) => {
    if (p.ptBalance === 0n) return;
    const allowanceResult = allowances?.[i];
    const currentAllowance =
      allowanceResult?.status === 'success' ? (allowanceResult.result as bigint) : undefined;
    const needsApproval = currentAllowance === undefined || currentAllowance < p.ptBalance;
    if (needsApproval) {
      calls.push(
        getWriteContractCall({
          to: p.market.ptToken,
          abi: erc20Abi,
          functionName: 'approve',
          args: [routerAddress, p.ptBalance]
        })
      );
    }
  });
  if (verifiedMulticall) {
    calls.push(
      getWriteContractCall({
        to: routerAddress,
        abi: PENDLE_ROUTER_V4_ABI,
        functionName: verifiedMulticall.functionName,
        args: verifiedMulticall.args
      })
    );
  }

  const enabled =
    activeEnabled &&
    isConnected &&
    !!verifiedMulticall &&
    !!routerAddress &&
    positions.length > 0 &&
    positions.every(p => p.ptBalance >= 0n) &&
    allowances !== undefined;

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
