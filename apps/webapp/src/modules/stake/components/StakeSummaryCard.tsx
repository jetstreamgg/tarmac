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
import { Button } from '@/components/ui/button';
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
    <div className="flex flex-col gap-1.5">
      <span className="text-textSecondary text-sm">{label}</span>
      {isLoading ? (
        <Skeleton className="h-5 w-20" />
      ) : (
        <span data-testid={dataTestId} className="text-text flex items-center gap-1.5 font-medium">
          {iconFirst && icon}
          {children}
          {!iconFirst && icon}
        </span>
      )}
    </div>
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
  const { data: toClaim, isLoading: claimableLoading } = useRewardContractsToClaim({
    rewardContractAddresses: rewardContracts?.map(({ contractAddress }) => contractAddress) ?? [],
    addresses: urnAddresses ?? [],
    chainId,
    enabled: Boolean(urnAddresses?.length && rewardContracts?.length)
  });
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
  const rewardIcons = (
    <span className="flex items-center -space-x-1">
      {rewardSymbolsHeld.map(symbol => (
        <TokenIcon key={symbol} token={{ symbol }} width={16} className="h-4 w-4" showChainIcon={false} />
      ))}
    </span>
  );

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

  return (
    <div
      data-testid="stake-summary-card"
      className="bg-panel rounded-card flex flex-col gap-6 p-8 backdrop-blur-2xl"
    >
      <span className="bg-surfaceAlt text-textSecondary flex h-6 w-fit items-center gap-1 rounded-full py-0.5 pr-2 pl-1.5 text-xs font-medium">
        <StakeSky className="h-3.5 w-3.5" />
        <Trans>Total Staked</Trans>
      </span>

      <div className="flex flex-col gap-1">
        <span className="text-text flex items-center gap-2 text-4xl font-medium tracking-tight">
          <TokenIcon token={{ symbol: 'SKY' }} width={32} className="h-8 w-8" showChainIcon={false} />
          {formatStakeAmount(totalStaked)}
        </span>
        {skyPriceLoading ? (
          <Skeleton className="h-4 w-28" />
        ) : (
          <span className="text-textSecondary text-sm">
            {totalStakedUsd !== null ? `~${formatUsd(totalStakedUsd)}` : NO_VALUE}
          </span>
        )}
      </div>

      <div className="border-textSecondary/10 grid grid-cols-2 gap-x-6 gap-y-5 border-t pt-5">
        <SummaryStat label={<Trans>Claimable rewards</Trans>} isLoading={claimableLoading} icon={rewardIcons}>
          {formatUsd(claimableUsd)}
        </SummaryStat>
        <SummaryStat
          label={<Trans>Total rewards earned</Trans>}
          isLoading={claimableLoading || historyLoading}
          icon={rewardIcons}
        >
          {formatUsd(rewardsEarnedUsd)}
        </SummaryStat>
        <SummaryStat
          label={<Trans>Total borrowed</Trans>}
          icon={<TokenIcon token={{ symbol: 'USDS' }} width={16} className="h-4 w-4" showChainIcon={false} />}
          iconFirst
        >
          {formatUsd(totalBorrowedUsd)}
        </SummaryStat>
        <SummaryStat label={<Trans>Net APY</Trans>} dataTestId="stake-summary-net-apy">
          {netApy !== null ? `${netApy > 0 ? '+' : ''}${formatDecimalPercentage(netApy)}` : NO_VALUE}
        </SummaryStat>
      </div>

      <Button
        variant="primary"
        className="w-full"
        onClick={onOpenPosition}
        data-testid="stake-open-new-position-cta"
      >
        <Trans>Open a new position</Trans>
      </Button>
    </div>
  );
}
