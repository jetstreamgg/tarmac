import { useChainId } from 'wagmi';
import { mainnet } from 'viem/chains';
import { Trans } from '@lingui/react/macro';
import { formatDecimalPercentage, isTestnetId } from '@/utils';
import { usePendleMarketsApiData, type PendleMarketConfig } from '@/hooks';
import { StatsOverviewCardCore } from '@/widgets/shared/components/ui/card/StatsOverviewCardCore';
import { StatsAccordionCard } from '@/widgets/shared/components/ui/card/StatsAccordionCard';
import { TokenIcon } from '@/widgets/shared/components/ui/token/TokenIcon';
import { MotionHStack } from '@/widgets/shared/components/ui/layout/MotionHStack';
import { MotionVStack } from '@/widgets/shared/components/ui/layout/MotionVStack';
import { HStack } from '@/widgets/shared/components/ui/layout/HStack';
import { Text } from '@/widgets/shared/components/ui/Typography';
import { Skeleton } from '@/widgets/components/ui/skeleton';
import { positionAnimations } from '@/widgets/shared/animation/presets';
import { PopoverRateInfo } from '@/widgets/shared/components/ui/PopoverRateInfo';

type PendleStatsCardProps = {
  market: PendleMarketConfig;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
};

/**
 * In-widget stats card mirroring MorphoVaultStatsCard's shape:
 * - Header: market name + Fixed APY
 * - Accordion: View PT contract + collapsible TVL row
 *
 * Sits at the top of the widget body (above the Supply/Withdraw form) to give
 * the user the same at-a-glance product info they'd see in the right details
 * pane — useful when the details pane is hidden or on narrow viewports.
 */
export const PendleStatsCard = ({ market, onExternalLinkClicked }: PendleStatsCardProps) => {
  const chainId = useChainId();
  const explorerChainId = isTestnetId(chainId) ? chainId : mainnet.id;
  const { data: allMarketsData, isLoading } = usePendleMarketsApiData();
  const marketData = allMarketsData?.[market.marketAddress];

  const apyDisplay =
    marketData?.impliedApy !== undefined ? formatDecimalPercentage(marketData.impliedApy) : '—';

  const maturityDisplay = new Date(market.expiry * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  const accordionContent = (
    <HStack className="mt-5 justify-between" gap={2}>
      <MotionVStack className="items-stretch justify-between" gap={2} variants={positionAnimations}>
        <Text className="text-textSecondary text-sm leading-4">
          <Trans>TVL</Trans>
        </Text>
        {isLoading ? (
          <Skeleton className="bg-textSecondary h-6 w-20" />
        ) : marketData?.formattedTvl ? (
          <Text>{marketData.formattedTvl}</Text>
        ) : (
          <Text>—</Text>
        )}
      </MotionVStack>
      <MotionVStack
        className="items-stretch justify-between text-right"
        gap={2}
        variants={positionAnimations}
      >
        <Text className="text-textSecondary text-sm leading-4">
          <Trans>Maturity</Trans>
        </Text>
        <Text className="whitespace-nowrap">{maturityDisplay}</Text>
      </MotionVStack>
    </HStack>
  );

  return (
    <StatsOverviewCardCore
      headerLeftContent={
        <MotionHStack className="items-center" gap={2} variants={positionAnimations}>
          <TokenIcon className="h-6 w-6" token={{ symbol: `PT-${market.underlyingSymbol}` }} />
          <Text>{market.name}</Text>
        </MotionHStack>
      }
      headerRightContent={
        <MotionHStack className="items-center" gap={2} variants={positionAnimations}>
          {isLoading ? (
            <Skeleton className="bg-textSecondary h-5 w-16" />
          ) : (
            <>
              <Text className="text-bullish">{apyDisplay}</Text>
              <PopoverRateInfo type="fixedYield" onExternalLinkClicked={onExternalLinkClicked} />
            </>
          )}
        </MotionHStack>
      }
      content={
        <StatsAccordionCard
          chainId={explorerChainId}
          address={market.ptToken}
          accordionTitle="Market info"
          accordionContent={accordionContent}
          onExternalLinkClicked={onExternalLinkClicked}
        />
      }
      className="cursor-default"
    />
  );
};
