import { ReactNode, useCallback, useMemo } from 'react';
import { useChainId, useConnection } from 'wagmi';
import { formatUnits } from 'viem';
import { Trans } from '@lingui/react/macro';
import {
  useSkyPrice,
  useAllStakeUrnAddresses,
  useStakeRewardContracts,
  useRewardContractsToClaim,
  usePrices,
  useStakeHistory,
  useMultipleRewardsChartInfo,
  useHighestRateFromChartData,
  useStakeHistoricData
} from '@/hooks';
import { formatUsd, formatDecimalPercentage } from '@/utils';
import { formatStakeAmount } from '../lib/formatStakeAmount';
import { calculateClaimedRewardsUsd } from '../lib/positionDetail';
import { QueryParams, NO_VALUE } from '@/lib/constants';
import { useAppSearchParams } from '@/lib/navigation';
import { useConnectThenAct } from '@/modules/ui/context/ConnectThenActContext';
import { StakeSky } from '@/modules/icons';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { TokenIconStack } from '@/modules/ui/components/TokenIconStack';
import { Button } from '@/components/ui/button';
import { PositionHero } from '@/components/product/PositionHero';
import {
  ProductActions,
  ProductPositionCard,
  ProductStat,
  ProductStatPair
} from '@/components/product/ProductCard';
import { Skeleton } from '@/components/ui/skeleton';
import { StakeUserPosition } from '../hooks/useStakeUserPositions';
import { useStakeTotalDebt } from '../hooks/useStakeTotalDebt';

/**
 * Net APY per BL-13: staking-reward APY netted against the borrow-cost APY on
 * the borrowed USDS, weighted by position size — and honestly negative when
 * borrow cost outweighs rewards. Null when there is nothing staked or no
 * rewards rate to net against.
 */
export function calculateNetApy({
  rewardsRate,
  borrowRate,
  stakedUsd,
  borrowedUsd
}: {
  rewardsRate: number | null;
  borrowRate: number | null;
  stakedUsd: number;
  borrowedUsd: number;
}): number | null {
  if (rewardsRate === null || !Number.isFinite(rewardsRate) || stakedUsd <= 0) return null;
  const borrowCost = (borrowRate ?? 0) * borrowedUsd;
  return (rewardsRate * stakedUsd - borrowCost) / stakedUsd;
}

function SummaryStat({
  label,
  icon,
  iconFirst = false,
  isLoading,
  dataTestId,
  children
}: {
  label: ReactNode;
  icon?: ReactNode;
  /** Hi-fi places the token icon before some values (Total borrowed) and after others. */
  iconFirst?: boolean;
  isLoading?: boolean;
  dataTestId?: string;
  children: ReactNode;
}) {
  return (
    <ProductStat label={label}>
      {isLoading ? (
        <Skeleton className="h-5 w-20" />
      ) : (
        <span data-testid={dataTestId} className="flex items-center gap-1">
          {iconFirst && icon}
          {children}
          {!iconFirst && icon}
        </span>
      )}
    </ProductStat>
  );
}

/**
 * Aggregate "My position" summary card (hi-fi 486:31830 right rail): total
 * staked hero, claimable/earned/borrowed stats, the BL-13 Net APY (negative
 * shown as-is), and the connect-gated "Open a new position" CTA that stages
 * the F4 takeover via `flow=open`.
 */
export function StakeSummaryCard({ positions }: { positions?: StakeUserPosition[] }) {
  const chainId = useChainId();
  const { address } = useConnection();
  const [, setSearchParams] = useAppSearchParams();

  const openPosition = useCallback(() => {
    setSearchParams(
      params => {
        params.set(QueryParams.Flow, 'open');
        return params;
      },
      { replace: true }
    );
  }, [setSearchParams]);
  const onOpenPosition = useConnectThenAct(openPosition, 'stake_open');

  const totalStaked = (positions ?? []).reduce((total, position) => total + position.skyLocked, 0n);
  const subgraphTotalBorrowed = (positions ?? []).reduce((total, position) => total + position.usdsDebt, 0n);

  // USD figures: SKY via the protocol price feed; USDS at parity (the same
  // convention the Savings transactions table uses).
  const { priceString: skyPriceString, isLoading: skyPriceLoading } = useSkyPrice();
  const skyPrice = skyPriceString ? parseFloat(skyPriceString) : null;
  const totalStakedUsd = skyPrice !== null ? Number(formatUnits(totalStaked, 18)) * skyPrice : null;

  // Claimable rewards across every urn, valued via the price feed.
  const { data: urnAddresses } = useAllStakeUrnAddresses(address);

  // Total borrowed = LIVE Vat debt (principal + accrued interest, legacy
  // parity); the subgraph principal stands in until the batch read lands.
  const { data: liveTotalDebt } = useStakeTotalDebt(urnAddresses);
  const totalBorrowed = liveTotalDebt ?? subgraphTotalBorrowed;
  const totalBorrowedUsd = Number(formatUnits(totalBorrowed, 18));
  const { data: rewardContracts } = useStakeRewardContracts();
  const {
    data: toClaim,
    isLoading: claimableLoading,
    error: claimableError
  } = useRewardContractsToClaim({
    rewardContractAddresses: rewardContracts?.map(({ contractAddress }) => contractAddress) ?? [],
    addresses: urnAddresses ?? [],
    chainId,
    enabled: Boolean(urnAddresses?.length && rewardContracts?.length)
  });
  // A failed claimables read is "unknown", not $0.00 — dash both reward stats.
  const claimableUnavailable = Boolean(claimableError && !toClaim);
  const { data: prices, isLoading: pricesLoading } = usePrices();
  const priceOf = useCallback((symbol: string) => parseFloat(prices?.[symbol]?.price ?? '0'), [prices]);
  const claimableUsd = (toClaim ?? []).reduce(
    (total, reward) => total + Number(formatUnits(reward.claimBalance, 18)) * priceOf(reward.rewardSymbol),
    0
  );

  // Reward stats carry the icons of what is actually claimable (SKY fallback),
  // e.g. an SPK-earning urn shows the SPK icon — mirrors the table cell.
  const rewardSymbolsHeld =
    toClaim && toClaim.length > 0 ? [...new Set(toClaim.map(reward => reward.rewardSymbol))] : ['SKY'];
  // 12px, matching the USDS mark on the borrow stats beside them and the comp
  // (1030:59227, APP-443 item 15) — they were 16.
  const rewardIcons = <TokenIconStack symbols={rewardSymbolsHeld} size={12} />;

  // Total rewards earned = already-claimed reward events (subgraph) + still
  // claimable. Claimed amounts are valued through the known reward-contract →
  // token map; unknown contracts are skipped rather than mispriced.
  const { data: stakeHistory, isLoading: historyLoading } = useStakeHistory();
  const claimedUsd = useMemo(
    () => calculateClaimedRewardsUsd(stakeHistory, chainId, priceOf),
    [stakeHistory, chainId, priceOf]
  );
  const rewardsEarnedUsd = claimedUsd + claimableUsd;

  // Net APY inputs: highest live staking-reward rate; latest historic borrow rate.
  const { data: rewardsChartInfo } = useMultipleRewardsChartInfo({
    rewardContractAddresses: rewardContracts?.map(({ contractAddress }) => contractAddress) ?? []
  });
  const highestRateData = useHighestRateFromChartData(rewardsChartInfo ?? []);
  const parsedRate = highestRateData ? parseFloat(highestRateData.rate) : NaN;
  const rewardsRate = Number.isFinite(parsedRate) ? parsedRate : null;

  const { data: historicData } = useStakeHistoricData();
  const latestHistoric = historicData
    ?.slice()
    .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())[0];
  const borrowRate = latestHistoric?.borrowRate ?? null;

  const netApy = calculateNetApy({
    rewardsRate,
    borrowRate,
    stakedUsd: totalStakedUsd ?? 0,
    borrowedUsd: totalBorrowedUsd
  });

  // The desktop comp (1036:214138) adopts the structure the phone tier
  // (1222:16799) already had — the badge + hero figure in a 6px-inset "Cover"
  // with a bottom brand wash — so the card is now the shared position skeleton
  // at every tier, with the SKY total (no fraction split) over a USD subline.
  return (
    <ProductPositionCard
      data-testid="stake-summary-card"
      className="rounded-[20px] md:rounded-[28px]"
      hero={
        <PositionHero
          pillIcon={<StakeSky className="h-3 w-3" />}
          pillLabel={<Trans>Total Staked</Trans>}
          balanceSymbol="SKY"
          amount={formatStakeAmount(totalStaked)}
          subline={
            skyPriceLoading ? (
              <Skeleton className="h-4 w-28" />
            ) : totalStakedUsd !== null ? (
              `~${formatUsd(totalStakedUsd)}`
            ) : (
              NO_VALUE
            )
          }
        />
      }
      stats={
        <>
          <ProductStatPair grow>
            <SummaryStat
              label={<Trans>Claimable rewards</Trans>}
              isLoading={claimableLoading || pricesLoading}
              icon={rewardIcons}
            >
              {claimableUnavailable ? NO_VALUE : formatUsd(claimableUsd)}
            </SummaryStat>
            <SummaryStat
              label={<Trans>Total rewards received</Trans>}
              isLoading={claimableLoading || historyLoading || pricesLoading}
              icon={rewardIcons}
            >
              {claimableUnavailable ? NO_VALUE : formatUsd(rewardsEarnedUsd)}
            </SummaryStat>
          </ProductStatPair>
          <ProductStatPair grow>
            <SummaryStat
              label={<Trans>Total borrowed</Trans>}
              isLoading={positions === undefined && liveTotalDebt === undefined}
              icon={
                <TokenIcon
                  token={{ symbol: 'USDS' }}
                  width={12}
                  className="h-3 w-3 shrink-0"
                  showChainIcon={false}
                />
              }
              iconFirst
            >
              {formatUsd(totalBorrowedUsd)}
            </SummaryStat>
            {/* Net APY is the one rate here that can go negative, so it keeps
                the plain "%" rather than the success gradient. */}
            <SummaryStat label={<Trans>Net APY</Trans>} dataTestId="stake-summary-net-apy">
              {netApy !== null ? `${netApy > 0 ? '+' : ''}${formatDecimalPercentage(netApy)}` : NO_VALUE}
            </SummaryStat>
          </ProductStatPair>
        </>
      }
      actions={
        <ProductActions>
          <Button
            variant="primary"
            size="l"
            onClick={onOpenPosition}
            data-testid="stake-open-new-position-cta"
          >
            <Trans>Open a new position</Trans>
          </Button>
        </ProductActions>
      }
    />
  );
}
