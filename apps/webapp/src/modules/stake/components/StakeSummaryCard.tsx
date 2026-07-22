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
import { QueryParams } from '@/lib/constants';
import { useAppSearchParams } from '@/lib/navigation';
import { useConnectThenAct } from '@/modules/ui/context/ConnectThenActContext';
import { StakeSky } from '@/modules/icons';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { TokenIconStack } from '@/modules/ui/components/TokenIconStack';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StakeUserPosition } from '../hooks/useStakeUserPositions';
import { useStakeTotalDebt } from '../hooks/useStakeTotalDebt';

const NO_VALUE = '–';

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
    <div className="flex min-w-0 flex-1 flex-col gap-1 md:flex-none md:gap-1.5">
      <span className="text-fgSecondary md:text-textSecondary text-xs leading-[18px] md:text-sm md:leading-normal">
        {label}
      </span>
      {isLoading ? (
        <Skeleton className="h-5 w-20" />
      ) : (
        <span
          data-testid={dataTestId}
          className="text-text font-circle flex items-center gap-1 text-sm leading-4 font-medium tracking-[-0.28px] md:gap-1.5 md:font-sans md:text-base md:leading-normal md:tracking-normal"
        >
          {iconFirst && icon}
          {children}
          {!iconFirst && icon}
        </span>
      )}
    </div>
  );
}

/** Hairline between the paired mobile stats (comp 1222:16814) — md uses the 2×2 grid instead. */
function StatDivider() {
  return <span className="bg-borderPrimary h-7 w-px shrink-0 md:hidden" aria-hidden />;
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
  const onOpenPosition = useConnectThenAct(openPosition);

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
  const { data: prices } = usePrices();
  const priceOf = useCallback((symbol: string) => parseFloat(prices?.[symbol]?.price ?? '0'), [prices]);
  const claimableUsd = (toClaim ?? []).reduce(
    (total, reward) => total + Number(formatUnits(reward.claimBalance, 18)) * priceOf(reward.rewardSymbol),
    0
  );

  // Reward stats carry the icons of what is actually claimable (SKY fallback),
  // e.g. an SPK-earning urn shows the SPK icon — mirrors the table cell.
  const rewardSymbolsHeld =
    toClaim && toClaim.length > 0 ? [...new Set(toClaim.map(reward => reward.rewardSymbol))] : ['SKY'];
  const rewardIcons = <TokenIconStack symbols={rewardSymbolsHeld} size={16} />;

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

  // Phone tier (comp 1222:16799): the badge + hero amount live in a 6px-inset
  // "Cover" surface with a bottom brand-gradient wash, the stats pair up with
  // hairline dividers, and the card tightens to a 20px radius. The `md:contents`
  // wrappers flatten away so the desktop hi-fi structure (p-8 card, 2×2
  // border-top grid) is untouched.
  return (
    <Card
      data-testid="stake-summary-card"
      className="flex flex-col rounded-[20px] p-0 md:gap-6 md:rounded-[28px] md:p-8"
    >
      <div className="px-1.5 pt-1.5 md:contents">
        <div className="flex flex-col gap-8 rounded-2xl bg-linear-to-b from-[rgba(182,179,252,0)] from-50% to-[#756fec]/10 p-4 md:contents">
          <span className="bg-surfaceAlt text-fgSecondary md:text-textSecondary font-circle flex h-6 w-fit items-center gap-1 rounded-full py-0.5 pr-2 pl-1 text-xs leading-[14px] font-medium tracking-[-0.24px] md:pl-1.5 md:font-sans md:leading-4 md:tracking-normal">
            <StakeSky className="h-3 w-3 md:h-3.5 md:w-3.5" />
            <Trans>Total Staked</Trans>
          </span>

          <div className="flex flex-col gap-2 md:gap-1">
            <span className="text-text font-circle flex items-center gap-2 text-[44px] leading-[48px] font-medium tracking-[-0.88px] md:font-sans md:text-4xl md:leading-normal md:tracking-tight">
              <TokenIcon token={{ symbol: 'SKY' }} width={32} className="h-8 w-8" showChainIcon={false} />
              {formatStakeAmount(totalStaked)}
            </span>
            {skyPriceLoading ? (
              <Skeleton className="h-4 w-28" />
            ) : (
              <span className="text-fgSecondary md:text-textSecondary pl-10 text-xs leading-[18px] md:pl-0 md:text-sm md:leading-normal">
                {totalStakedUsd !== null ? `~${formatUsd(totalStakedUsd)}` : NO_VALUE}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 p-5 md:contents">
        <div className="md:border-textSecondary/10 flex flex-col gap-5 md:grid md:grid-cols-2 md:gap-x-6 md:gap-y-5 md:border-t md:pt-5">
          <div className="flex items-center gap-6 md:contents">
            <SummaryStat
              label={<Trans>Claimable rewards</Trans>}
              isLoading={claimableLoading}
              icon={rewardIcons}
            >
              {claimableUnavailable ? NO_VALUE : formatUsd(claimableUsd)}
            </SummaryStat>
            <StatDivider />
            <SummaryStat
              label={<Trans>Total rewards earned</Trans>}
              isLoading={claimableLoading || historyLoading}
              icon={rewardIcons}
            >
              {claimableUnavailable ? NO_VALUE : formatUsd(rewardsEarnedUsd)}
            </SummaryStat>
          </div>
          <div className="flex items-center gap-6 md:contents">
            <SummaryStat
              label={<Trans>Total borrowed</Trans>}
              icon={
                <TokenIcon
                  token={{ symbol: 'USDS' }}
                  width={16}
                  className="h-3 w-3 md:h-4 md:w-4"
                  showChainIcon={false}
                />
              }
              iconFirst
            >
              {formatUsd(totalBorrowedUsd)}
            </SummaryStat>
            <StatDivider />
            <SummaryStat label={<Trans>Net APY</Trans>} dataTestId="stake-summary-net-apy">
              {netApy !== null ? `${netApy > 0 ? '+' : ''}${formatDecimalPercentage(netApy)}` : NO_VALUE}
            </SummaryStat>
          </div>
        </div>

        <Button
          variant="primary"
          size="l"
          className="w-full"
          onClick={onOpenPosition}
          data-testid="stake-open-new-position-cta"
        >
          <Trans>Open a new position</Trans>
        </Button>
      </div>
    </Card>
  );
}
