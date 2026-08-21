import { ReactNode, useCallback } from 'react';
import { Trans } from '@lingui/react/macro';
import { StakeSky } from '@/modules/icons';
import {
  ProductBadge,
  ProductStat,
  ProductStatPair,
  ProductSupplyCard
} from '@/components/product/ProductCard';
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
      // align-middle centers to the line's x-height; nudge up so the icon
      // centers on the text's cap-height instead of sitting low — the same
      // tuning SavingsSupplyCard's inline chip already carries (review item B8).
      className={
        isHeadline ? 'mx-1 inline-block h-5 w-5 -translate-y-0.5 align-middle md:h-6 md:w-6' : 'h-4 w-4'
      }
      showChainIcon={false}
    />
  );
}

/** The engine card's stat pair: the comp (1036:208779) leads each value with its token mark. */
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
    <ProductStat size="lg" label={label}>
      {isLoading ? (
        <Skeleton className="h-5 w-20" />
      ) : (
        <>
          {!error && icon}
          {error ? NO_VALUE : children}
        </>
      )}
    </ProductStat>
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
  const onOpenPosition = useConnectThenAct(openPosition, 'stake_open');

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
  // The comp tags the figure with the USDS mark rather than spelling the symbol
  // out, so the value is the bare number.
  const {
    data: collateralData,
    isLoading: collateralLoading,
    error: collateralError
  } = useCollateralData(getIlkName(2));
  const minBorrow =
    collateralData?.dust !== undefined ? formatBigInt(math.convertRadToWad(collateralData.dust)) : NO_VALUE;

  // The card follows the shared no-position skeleton (1036:208779); it is the
  // only one with no blurb between the headline and the stats.
  return (
    <ProductSupplyCard
      data-testid="stake-engine-card"
      // Opt-in only for this usage (review item B7): every product-detail
      // chart is a fixed 405px tall on desktop, so the card targets that
      // min-height directly instead of stretching to match a sibling's grid
      // row — this keeps the card correctly sized on the About tab too,
      // which has no chart at all. The internal itemSpacing goes to the
      // measured 32px (gap-8) uniformly, overriding the shared card's
      // default gap-5/md:gap-6 via the className merge.
      sizeToChart
      className="gap-8 md:gap-8"
      badges={
        <ProductBadge icon={<StakeSky className="h-3 w-3" />}>
          <Trans>Sky Staking Engine</Trans>
        </ProductBadge>
      }
      title={
        <span data-testid="stake-engine-headline">
          {/* The trailing phrase is grouped in a non-breaking span so it wraps
              as a unit (review item B8, comp: "and" opens the final line) —
              robust across widths/locales, unlike a hardcoded <br>. */}
          <Trans>
            Stake <InlineTokenIcon symbol="SKY" />
            SKY to accrue rewards, delegate votes{' '}
            <span className="whitespace-nowrap">
              and borrow <InlineTokenIcon symbol="USDS" />
              USDS
            </span>
          </Trans>
        </span>
      }
      stats={
        <ProductStatPair>
          <Stat
            label={<Trans>Rewards rate</Trans>}
            icon={<InlineTokenIcon symbol="SKY" variant="stat" />}
            isLoading={rewardsLoading}
          >
            {rewardsRate}
          </Stat>
          <Stat
            label={<Trans>Min. borrow amount</Trans>}
            icon={<InlineTokenIcon symbol="USDS" variant="stat" />}
            isLoading={collateralLoading}
            error={collateralError}
          >
            {minBorrow}
          </Stat>
        </ProductStatPair>
      }
      cta={
        <Button
          variant="primary"
          size="l"
          className="w-full"
          onClick={onOpenPosition}
          data-testid="stake-open-position-cta"
        >
          <Trans>Open a position</Trans>
        </Button>
      }
    />
  );
}
