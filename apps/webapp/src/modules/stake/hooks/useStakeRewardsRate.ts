import { useMemo, useRef } from 'react';
import { useStakeRewardContracts, useMultipleRewardsChartInfo, type RewardsChartInfoParsed } from '@/hooks';

// Full farm history: the Statistics chart's `All` range and the trailing
// 6-month mean both need more than the endpoint's 100-point default.
const FULL_HISTORY_LIMIT = 9999;

export type StakeRewardsRate = {
  /** Historic rate series of the winning farm (ascending fetch order preserved). */
  series: RewardsChartInfoParsed[];
  /** Latest rate of the winning farm as a decimal fraction (0.0569 = 5.69%). */
  currentRate: number | null;
  isLoading: boolean;
  error: Error | null;
};

/**
 * The staking-engine rewards rate the Statistics tab shows (product call on the
 * F1 review: the rate surfaces show what stakers earn, not the borrow rate).
 * Winner selection mirrors `useHighestRateFromChartData` — the farm whose most
 * recent datapoint has the highest rate, first-highest on ties — so the chart
 * hero and details rows always agree with the promo card's `Rewards rate`.
 * Unlike that hook this one also returns the winner's full historic series,
 * which the chart plots and the 6M mean averages.
 */
export function useStakeRewardsRate(): StakeRewardsRate {
  const { data: rewardContracts, isLoading: contractsLoading } = useStakeRewardContracts();
  const {
    data: rewardsChartInfo,
    isLoading: chartsLoading,
    error
  } = useMultipleRewardsChartInfo({
    rewardContractAddresses: rewardContracts?.map(({ contractAddress }) => contractAddress) || [],
    limit: FULL_HISTORY_LIMIT
  });

  const winner = useMemo(() => {
    const candidates = (rewardsChartInfo ?? [])
      .filter((series): series is RewardsChartInfoParsed[] => !!series && series.length > 0)
      .map(series => ({
        series,
        latest: [...series].sort((a, b) => b.blockTimestamp - a.blockTimestamp)[0]
      }))
      .filter(({ latest }) => latest.rate !== undefined && latest.rate !== null);
    if (candidates.length === 0) return null;
    return candidates.reduce((best, candidate) =>
      parseFloat(candidate.latest.rate || '0') > parseFloat(best.latest.rate || '0') ? candidate : best
    );
  }, [rewardsChartInfo]);

  const parsedRate = winner ? parseFloat(winner.latest.rate) : NaN;

  /**
   * Both underlying queries hand back `undefined` and re-report loading when
   * their key changes, not just on the first fetch — the contract list arrives
   * as a hardcoded placeholder before the indexer's real one replaces it, which
   * rewrites the farm URLs the chart query is keyed on, and an indexer failure
   * swaps the whole hook onto its on-chain fallback. Passed straight through,
   * each of those flips takes the chart back to its skeleton, and the chart
   * unmounting is what makes its entrance wipe play a second time.
   *
   * So the last series that actually resolved is held on to and kept on screen
   * while the next one loads. Only the true cold start, with nothing resolved
   * yet, still reports loading.
   */
  const lastResolved = useRef<{ series: RewardsChartInfoParsed[]; currentRate: number | null } | null>(null);
  if (winner) {
    lastResolved.current = {
      series: winner.series,
      currentRate: Number.isFinite(parsedRate) ? parsedRate : null
    };
  }
  const resolved = lastResolved.current;

  return {
    series: resolved?.series ?? [],
    currentRate: resolved?.currentRate ?? null,
    isLoading: (contractsLoading || chartsLoading) && !resolved,
    error: error ?? null
  };
}
