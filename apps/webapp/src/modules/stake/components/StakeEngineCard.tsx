import { ReactNode, useCallback } from 'react';
import { Trans } from '@lingui/react/macro';
import { StakeSky } from '@/modules/icons';
import {
  ProductBadge,
  ProductFigure,
  ProductStat,
  ProductSupplyCard
} from '@/components/product/ProductCard';
import { useStakeRewardContracts } from '@/hooks/stake/useStakeRewardContracts';
import { useMultipleRewardsChartInfo } from '@/hooks/rewards/useMultipleRewardsChartInfo';
import { useHighestRateFromChartData } from '@/hooks/stake/useHighestRateFromChartData';
import { useCollateralData } from '@/hooks/vaults/useCollateralData';
import { getIlkName } from '@/hooks/vaults/helpers';
import * as math from '@/utils/math';
import { formatBigInt, formatDecimalPercentage, formatPercent } from '@/utils/formatValue';
import { QueryParams, NO_VALUE } from '@/lib/constants';
import { useAppSearchParams } from '@/lib/navigation';
import { useConnectThenAct } from '@/modules/ui/context/ConnectThenActContext';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RateInfo } from '@/components/product/RateInfo';
import { FLOW_NAV_OPTIONS } from '../lib/flowNavigation';

// Inline token chip (hi-fi 486:31955). `headline` variant is 24px and flows in
// the heading text (vertically centered, with breathing room); `stat` variant is
// 12px and sits as a flex item beside the stat value (1036:208779).
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
      width={isHeadline ? 24 : 12}
      // Headline chips step down to 20px on the phone tier (comp 1222:17089).
      // align-middle centers to the line's x-height; nudge up so the icon
      // centers on the text's cap-height instead of sitting low — the same
      // tuning SavingsSupplyCard's inline chip already carries (review item B8).
      className={
        isHeadline ? 'mx-1 inline-block h-5 w-5 -translate-y-0.5 align-middle md:h-6 md:w-6' : 'h-3 w-3'
      }
      showChainIcon={false}
    />
  );
}

/**
 * One of the engine card's three stats (1036:208779): a Label 4 figure, led by
 * its token mark where the comp draws one. A value the read cannot source is
 * the bare fg-secondary dash, without the mark.
 */
function Stat({
  label,
  value,
  icon,
  isLoading,
  error,
  children
}: {
  label: ReactNode;
  /** The formatted figure, or `NO_VALUE`. */
  value: string;
  icon?: ReactNode;
  isLoading?: boolean;
  error?: Error | null;
  /** Rendered in place of `value` when the figure carries extra copy ("up to …"). */
  children?: ReactNode;
}) {
  return (
    <ProductStat size="md" label={label}>
      {isLoading ? (
        <Skeleton className="h-[18px] w-20" />
      ) : (
        <ProductFigure value={error ? NO_VALUE : value}>
          {icon}
          {children ?? value}
        </ProductFigure>
      )}
    </ProductStat>
  );
}

/**
 * Sky Staking Engine promo card, rendered by `StakeRailCard` as the
 * no-position rail on every tab. Read-only stat row — highest staking reward
 * rate, current borrow rate and the minimum borrow amount (APP-640) — over a
 * connect-gated "Open a position" CTA. In F2 the CTA only sets `flow=open`; F4
 * mounts the takeover on that param.
 */
export function StakeEngineCard() {
  const [, setSearchParams] = useAppSearchParams();

  // CTA stub: connected users get the URL param set; disconnected users hit the
  // connect flow first, then the same action runs (pattern: SavingsSupplyCard).
  const openPosition = useCallback(() => {
    setSearchParams(params => {
      params.set(QueryParams.Flow, 'open');
      return params;
    }, FLOW_NAV_OPTIONS);
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

  // Borrow rate — the onchain annualized stability fee from the same ilk read,
  // formatted exactly as the Open a position flow this card launches shows it,
  // so the two agree the moment a governance spell changes the rate.
  const borrowRate =
    collateralData?.stabilityFee !== undefined ? formatPercent(collateralData.stabilityFee) : NO_VALUE;

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
          {/* The trailing phrase is an inline-block so it moves to the final
              line as a unit when it fits (review item B8, comp: "and" opens the
              final line) — robust across widths/locales, unlike a hardcoded
              <br>. Unlike a non-breaking span it still wraps inside itself
              once the card is narrower than the phrase (the 3-column pane of
              the tablet grid, or a wallet extension panel beside a small
              desktop — APP-549), instead of running off the card edge. Each
              token mark is glued to its ticker so a break never separates
              them. */}
          <Trans>
            Stake{' '}
            <span className="whitespace-nowrap">
              <InlineTokenIcon symbol="SKY" />
              SKY
            </span>{' '}
            to accrue rewards, delegate votes{' '}
            <span className="inline-block">
              and borrow{' '}
              <span className="whitespace-nowrap">
                <InlineTokenIcon symbol="USDS" />
                USDS
              </span>
            </span>
          </Trans>
        </span>
      }
      stats={
        // Three content-width stats 16px apart with no hairlines (1036:208779).
        // The rail is narrower than that row (~312px) between the 1200px
        // breakpoint and ~1280px, so below a 19.5rem content box the gap
        // tightens to 8px to keep the stats on one line and the card at the
        // chart's 405px; narrower still (phones, the tablet grid's 3-column
        // pane) they wrap rather than overflow. The info glyph sits on the
        // label, 10px, 4px after the text.
        <div className="@container">
          <div
            className="flex flex-wrap gap-x-2 gap-y-4 @min-[19.5rem]:gap-x-4"
            data-testid="stake-engine-stats"
          >
            <Stat
              label={
                <>
                  <Trans>Rewards rate</Trans>
                  <RateInfo type="srr" size={10} />
                </>
              }
              value={rewardsRate}
              isLoading={rewardsLoading}
            >
              <Trans>up to {rewardsRate}</Trans>
            </Stat>
            <Stat
              label={
                <>
                  <Trans>Borrow rate</Trans>
                  <RateInfo type="sbr" size={10} />
                </>
              }
              value={borrowRate}
              isLoading={collateralLoading}
              error={collateralError}
            />
            <Stat
              label={<Trans>Min. borrow amount</Trans>}
              value={minBorrow}
              icon={<InlineTokenIcon symbol="USDS" variant="stat" />}
              isLoading={collateralLoading}
              error={collateralError}
            />
          </div>
        </div>
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
