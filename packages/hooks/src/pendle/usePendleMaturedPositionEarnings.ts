import { useMemo } from 'react';
import { useChainId, useReadContract } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { isTestnetId } from '@jetstreamgg/sky-utils';
import { usePendleMarketHistory } from './usePendleMarketHistory';
import { usePendleRedeemPreview } from './usePendleRedeemPreview';
import { PendleTradeAction } from './constants';
import type { PendleMarketConfig, PendleTransactionRaw } from './pendle';

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
 * Computes the user's realized earnings + APY for a matured PT position.
 *
 * Cost basis comes from BUY_PT/SELL_PT history (Pendle API, user-scoped).
 * Final value comes from the on-chain redeem preview, optionally converted to
 * USDS based on `market.usdsEquivalence`. Returns undefined values when the
 * data is insufficient (no buy history → likely transferred-in PT).
 *
 * chi is read at display time; tiny post-maturity drift is accepted as a
 * tradeoff for simplicity.
 */
export function usePendleMaturedPositionEarnings(
  market: PendleMarketConfig,
  ptBalance: bigint | undefined
): PendleMaturedPositionEarnings {
  const chainId = useChainId();
  const balanceChainId = isTestnetId(chainId) ? chainId : mainnet.id;

  const { data: rawHistory, isLoading: historyLoading } = usePendleMarketHistory(market.marketAddress);
  const { data: previewAmount, isLoading: previewLoading } = usePendleRedeemPreview(market, ptBalance);

  // TEMP: Pendle's API doesn't index Tenderly forks. On testnets, synthesize
  // one BUY_PT trade so QA can validate the layout/math. Revert before prod.
  const history = useMemo<PendleTransactionRaw[] | undefined>(() => {
    if (!rawHistory) return undefined;
    if (rawHistory.length > 0) return rawHistory;
    if (!isTestnetId(chainId)) return rawHistory;
    if (previewAmount === undefined || ptBalance === undefined || ptBalance === 0n) return rawHistory;
    const receiveTokens = Number(previewAmount as bigint) / 10 ** market.underlyingDecimals;
    return [
      {
        id: 'tenderly-mock',
        market: market.marketAddress,
        timestamp: new Date((market.expiry - 90 * 86_400) * 1000).toISOString(),
        chainId: 1,
        txHash: '0x0',
        value: receiveTokens * 0.95,
        type: 'TRADES',
        action: PendleTradeAction.BUY_PT,
        txOrigin: '0x0',
        impliedApy: 0
      }
    ];
  }, [rawHistory, chainId, previewAmount, ptBalance, market]);

  // TEMP: on Tenderly, coerce tier-3 markets (e.g. PT-sENA) into 'pegged'
  // treatment so QA can see the earnings line render. Numbers are nonsense
  // for non-stable underlyings but the layout is what we're validating.
  const effectiveTier = isTestnetId(chainId) ? (market.usdsEquivalence ?? 'pegged') : market.usdsEquivalence;

  const { data: chi } = useReadContract({
    abi: SUSDS_PREVIEW_REDEEM_ABI,
    address: market.underlyingToken,
    functionName: 'previewRedeem',
    args: [ONE],
    chainId: balanceChainId,
    query: { enabled: market.usdsEquivalence === 'sUSDS' }
  });

  const result = useMemo<Omit<PendleMaturedPositionEarnings, 'isLoading'>>(() => {
    const empty = { earnings: undefined, apy: undefined, currency: undefined };
    // No honest math without a USDS-equivalence rule (tx.value is USD, but
    // a non-stable underlying receive amount isn't) — skip earnings entirely.
    if (!effectiveTier) return empty;
    if (!history || previewAmount === undefined) return empty;

    const buys = history.filter(t => t.action === PendleTradeAction.BUY_PT);
    const sells = history.filter(t => t.action === PendleTradeAction.SELL_PT);
    if (buys.length === 0) return empty;

    const totalSpentUsd = buys.reduce((s, t) => s + t.value, 0);
    const totalRecoveredUsd = sells.reduce((s, t) => s + t.value, 0);
    const netCostUsd = totalSpentUsd - totalRecoveredUsd;
    if (netCostUsd <= 0) return empty;

    const receiveTokens = Number(previewAmount as bigint) / 10 ** market.underlyingDecimals;

    let finalValue: number;
    if (effectiveTier === 'pegged') {
      finalValue = receiveTokens;
    } else {
      if (chi === undefined) return empty;
      const usdsPerSusds = Number(chi as bigint) / 1e18;
      finalValue = receiveTokens * usdsPerSusds;
    }
    // When the market is genuinely USDS-equivalent (tier 1 or 2), label as
    // USDS. When the line is rendering only because the Tenderly TEMP coerced
    // a tier-3 market into 'pegged', label with the underlying symbol so the
    // unit shown matches the receive token.
    const currency = market.usdsEquivalence ? 'USDS' : market.underlyingSymbol;

    const earnings = finalValue - netCostUsd;

    const earliestBuyTimestamp = Math.min(...buys.map(t => Number(new Date(t.timestamp)) / 1000));
    const daysHeld = (market.expiry - earliestBuyTimestamp) / 86_400;
    const apy =
      daysHeld > 0 && netCostUsd > 0 ? Math.pow(finalValue / netCostUsd, 365 / daysHeld) - 1 : undefined;

    return { earnings, apy, currency };
  }, [history, previewAmount, chi, market, effectiveTier]);

  return { ...result, isLoading: historyLoading || previewLoading };
}
