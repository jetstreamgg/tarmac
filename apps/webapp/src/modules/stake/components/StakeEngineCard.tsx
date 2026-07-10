import { ReactNode, useCallback } from 'react';
import { Trans } from '@lingui/react/macro';
import { StakeSky } from '@/modules/icons';
import {
  useStakeRewardContracts,
  useMultipleRewardsChartInfo,
  useHighestRateFromChartData,
  useCollateralData,
  getIlkName
} from '@/hooks';
import { formatBigInt, formatDecimalPercentage, math } from '@/utils';
import { QueryParams } from '@/lib/constants';
import { useAppSearchParams } from '@/lib/navigation';
import { useConnectThenAct } from '@/modules/ui/context/ConnectThenActContext';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const NO_VALUE = '–';

// Inline token chip (hi-fi 486:31955). `headline` variant is 24px and flows in
// the heading text (vertically centered, with breathing room); `stat` variant is
// 16px and sits as a flex item beside the stat value.
function InlineTokenIcon({
  symbol,
  variant = 'headline'
}: {
  symbol: string;
  variant?: 'headline' | 'stat';
}) {
  const isHeadline = variant === 'headline';
  return (
    <TokenIcon
      token={{ symbol }}
      width={isHeadline ? 24 : 16}
      className={isHeadline ? 'mx-1 inline-block h-6 w-6 align-middle' : 'h-4 w-4'}
      showChainIcon={false}
    />
  );
}

function Stat({
  label,
  icon,
  isLoading,
  error,
  children
}: {
  label: ReactNode;
  icon?: ReactNode;
  isLoading?: boolean;
  error?: Error | null;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-textSecondary text-sm">{label}</span>
      {isLoading ? (
        <Skeleton className="h-5 w-20" />
      ) : (
        <span className="text-text flex items-center gap-1.5 font-medium">
          {!error && icon}
          {error ? NO_VALUE : children}
        </span>
      )}
    </div>
  );
}

/**
 * Sky Staking Engine promo card (Statistics + About tabs, later the positions
 * empty state). Read-only stat pair — highest staking reward rate and the
 * minimum borrow amount — over a connect-gated "Open a position" CTA. In F2 the
 * CTA only sets `flow=open`; F4 mounts the takeover on that param.
 */
export function StakeEngineCard() {
  const [, setSearchParams] = useAppSearchParams();

  // CTA stub: connected users get the URL param set; disconnected users hit the
  // connect flow first, then the same action runs (pattern: SavingsSupplyCard).
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

  // Rewards rate — same data source the legacy StakingRewardRateCard uses.
  const { data: rewardContracts, isLoading: contractsLoading } = useStakeRewardContracts();
  const { data: rewardsChartInfo, isLoading: chartsLoading } = useMultipleRewardsChartInfo({
    rewardContractAddresses: rewardContracts?.map(({ contractAddress }) => contractAddress) || []
  });
  const highestRateData = useHighestRateFromChartData(rewardsChartInfo || []);
  const rewardsLoading = contractsLoading || chartsLoading;
  const highestRate = highestRateData ? parseFloat(highestRateData.rate) : null;
  const rewardsRate =
    highestRate !== null && !isNaN(highestRate) ? formatDecimalPercentage(highestRate) : NO_VALUE;

  // Min. borrow amount — dust (RAD) from the staking-engine ilk, shown as USDS.
  const {
    data: collateralData,
    isLoading: collateralLoading,
    error: collateralError
  } = useCollateralData(getIlkName(2));
  const minBorrow =
    collateralData?.dust !== undefined
      ? `${formatBigInt(math.convertRadToWad(collateralData.dust))} USDS`
      : NO_VALUE;

  return (
    <Card data-testid="stake-engine-card" className="flex flex-col gap-8 p-8">
      <span className="bg-surfaceAlt text-textSecondary flex h-6 w-fit items-center gap-1 rounded-full py-0.5 pr-2 pl-1.5 text-xs font-medium">
        <StakeSky className="h-3.5 w-3.5" />
        <Trans>Sky Staking Engine</Trans>
      </span>

      <h3
        data-testid="stake-engine-headline"
        className="text-text text-[28px] leading-[30px] font-medium tracking-tight"
      >
        <Trans>
          Stake <InlineTokenIcon symbol="SKY" />
          SKY to earn rewards, delegate votes and borrow <InlineTokenIcon symbol="USDS" />
          USDS
        </Trans>
      </h3>

      <div className="flex items-center gap-6">
        <Stat
          label={<Trans>Rewards rate</Trans>}
          icon={<InlineTokenIcon symbol="SKY" variant="stat" />}
          isLoading={rewardsLoading}
        >
          {rewardsRate}
        </Stat>
        <span className="bg-textSecondary/20 h-7 w-px shrink-0" aria-hidden />
        <Stat
          label={<Trans>Min. borrow amount</Trans>}
          icon={<InlineTokenIcon symbol="USDS" variant="stat" />}
          isLoading={collateralLoading}
          error={collateralError}
        >
          {minBorrow}
        </Stat>
      </div>

      <Button
        variant="primary"
        size="l"
        className="w-full"
        onClick={onOpenPosition}
        data-testid="stake-open-position-cta"
      >
        <Trans>Open a position</Trans>
      </Button>
    </Card>
  );
}
