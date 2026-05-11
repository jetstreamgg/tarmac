import { useMemo } from 'react';
import { useChainId, useReadContract } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { isTestnetId } from '@jetstreamgg/sky-utils';
import { usePendleMarketHistory } from './usePendleMarketHistory';
import { usePendleRedeemPreview } from './usePendleRedeemPreview';
import { computeMaturedEarnings } from './computeMaturedEarnings';
import type { PendleMarketConfig } from './pendle';

const SUSDS_PREVIEW_REDEEM_ABI = [
  {
    type: 'function',
    name: 'previewRedeem',
    stateMutability: 'view',
    inputs: [{ name: 'shares', type: 'uint256' }],
    outputs: [{ name: 'assets', type: 'uint256' }]
  }
] as const;

const ONE = 1_000_000_000_000_000_000n;

export type PendleMaturedPositionEarnings = {
  /** Earnings amount (final value − net cost basis), in `currency` units. */
  earnings?: number;
  /** Annualized yield as a decimal (e.g. 0.0521 for 5.21% APY). */
  apy?: number;
  /** Display symbol for both `earnings` and the cost basis math (e.g. 'USDS', 'sENA'). */
  currency?: string;
  /** True until both market history and the on-chain receive amount have resolved. */
  isLoading: boolean;
};

/**
 * Wagmi-wiring wrapper around `computeMaturedEarnings`. Pulls trade history,
 * the on-chain redeem preview, and (for sUSDS markets) the chi conversion
 * rate, then threads them into the pure function. All earnings logic — the
 * reconciliation gate, APY policy, currency selection — lives there. See
 * computeMaturedEarnings.ts for the design rationale.
 */
export function usePendleMaturedPositionEarnings(
  market: PendleMarketConfig,
  ptBalance: bigint | undefined
): PendleMaturedPositionEarnings {
  const chainId = useChainId();
  const balanceChainId = isTestnetId(chainId) ? chainId : mainnet.id;

  const { data: history, isLoading: historyLoading } = usePendleMarketHistory(market.marketAddress);
  const { data: previewAmount, isLoading: previewLoading } = usePendleRedeemPreview(market, ptBalance);

  const { data: chi } = useReadContract({
    abi: SUSDS_PREVIEW_REDEEM_ABI,
    address: market.underlyingToken,
    functionName: 'previewRedeem',
    args: [ONE],
    chainId: balanceChainId,
    query: { enabled: market.usdsEquivalence === 'sUSDS' }
  });

  // PT tokens are 18-decimal across all of Pendle's SY/PT/YT architecture
  // (same `ONE = 1e18` constant the redeem-preview path uses for pyIndex).
  // If a future market deploys with non-18-decimal PT, this divisor and the
  // preview math both break together — handle in PENDLE_MARKETS at that time.
  const ptBalanceFloat = Number(ptBalance ?? 0n) / 1e18;

  const result = useMemo<Omit<PendleMaturedPositionEarnings, 'isLoading'>>(
    () =>
      computeMaturedEarnings({
        history,
        previewAmount,
        chi,
        market,
        effectiveTier: market.usdsEquivalence,
        ptBalanceFloat
      }),
    [history, previewAmount, chi, market, ptBalanceFloat]
  );

  return { ...result, isLoading: historyLoading || previewLoading };
}
