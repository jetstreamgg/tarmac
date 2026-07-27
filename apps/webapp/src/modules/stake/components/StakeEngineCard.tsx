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
      // Headline chips step down to 20px on the phone tier (comp 1222:17089).
      className={isHeadline ? 'mx-1 inline-block h-5 w-5 align-middle md:h-6 md:w-6' : 'h-4 w-4'}
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
    <div className="flex flex-col gap-1 md:gap-1.5">
      <span className="text-fgSecondary md:text-textSecondary text-xs leading-[18px] md:text-sm md:leading-normal">
        {label}
      </span>
      {isLoading ? (
        <Skeleton className="h-5 w-20" />
      ) : (
        <span className="text-text font-circle flex items-center gap-1.5 text-base leading-[18px] font-medium tracking-[-0.32px] md:font-sans md:leading-normal md:tracking-normal">
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

  // Phone tier (comp 1222:17089): tighter 20px paddings, Heading 4 headline
  // with 20px inline token chips, and an extra 20px above the stats row.
  return (
    <Card data-testid="stake-engine-card" className="flex flex-col gap-5 p-5 md:gap-8 md:p-8">
      <span className="bg-surfaceAlt text-fgSecondary md:text-textSecondary font-circle flex h-6 w-fit items-center gap-1 rounded-full py-0.5 pr-2 pl-1 text-xs leading-[14px] font-medium tracking-[-0.24px] md:pl-1.5 md:font-sans md:leading-4 md:tracking-normal">
        <StakeSky className="h-3 w-3 md:h-3.5 md:w-3.5" />
        <Trans>Sky Staking Engine</Trans>
      </span>

      <h3
        data-testid="stake-engine-headline"
        className="text-text font-circle text-[22px] leading-6 font-medium tracking-[-0.44px] md:font-sans md:text-[28px] md:leading-[30px] md:tracking-tight"
      >
        <Trans>
          Stake <InlineTokenIcon symbol="SKY" />
          SKY to earn rewards, delegate votes and borrow <InlineTokenIcon symbol="USDS" />
          USDS
        </Trans>
      </h3>

      <div className="flex items-center gap-6 pt-5 md:pt-0">
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
