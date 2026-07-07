import { ReactNode, useCallback } from 'react';
import { Trans } from '@lingui/react/macro';
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
import { Skeleton } from '@/components/ui/skeleton';

const NO_VALUE = '–';

// Inline token chip for the headline / stat values (hi-fi 486:31955).
function InlineTokenIcon({ symbol }: { symbol: string }) {
  return (
    <TokenIcon
      token={{ symbol }}
      width={24}
      className="inline-flex h-6 w-6 align-text-bottom"
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
    <div
      data-testid="stake-engine-card"
      className="bg-panel rounded-card flex flex-col gap-6 p-6 backdrop-blur-2xl"
    >
      <span className="text-textSecondary text-sm">
        <Trans>Sky Staking Engine</Trans>
      </span>

      <h3 data-testid="stake-engine-headline" className="text-text text-3xl leading-snug font-medium">
        <Trans>
          Stake <InlineTokenIcon symbol="SKY" />
          SKY to earn rewards, delegate votes and borrow <InlineTokenIcon symbol="USDS" />
          USDS
        </Trans>
      </h3>

      <div className="grid grid-cols-2 gap-4">
        <Stat
          label={<Trans>Rewards rate</Trans>}
          icon={<InlineTokenIcon symbol="SKY" />}
          isLoading={rewardsLoading}
        >
          {rewardsRate}
        </Stat>
        <Stat
          label={<Trans>Min. borrow amount</Trans>}
          icon={<InlineTokenIcon symbol="USDS" />}
          isLoading={collateralLoading}
          error={collateralError}
        >
          {minBorrow}
        </Stat>
      </div>

      <Button
        variant="primary"
        className="w-full"
        onClick={onOpenPosition}
        data-testid="stake-open-position-cta"
      >
        <Trans>Open a position</Trans>
      </Button>
    </div>
  );
}
