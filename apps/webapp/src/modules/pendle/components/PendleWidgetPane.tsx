import { useMemo } from 'react';
import { Trans } from '@lingui/react/macro';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useChainId } from 'wagmi';
import { mainnet } from 'viem/chains';
import {
  isMarketMatured,
  PENDLE_MARKETS,
  usePendleUserPtBalances,
  type PendleMarketConfig
} from '@jetstreamgg/sky-hooks';
import { isTestnetId } from '@jetstreamgg/sky-utils';
import {
  CardAnimationWrapper,
  PendleWidget,
  WidgetContainer,
  positionAnimations
} from '@jetstreamgg/sky-widgets';
import { PendleIntent } from '@/lib/enums';
import { PendleIntentMapping, QueryParams } from '@/lib/constants';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { SharedProps } from '@/modules/app/types/Widgets';
import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';
import { PendleMarketStatsCard } from './PendleMarketStatsCard';
import { PendleReadyToRedeemList } from './PendleReadyToRedeemList';

const findMarket = (address: string | null): PendleMarketConfig | undefined => {
  if (!address) return undefined;
  const lower = address.toLowerCase();
  return PENDLE_MARKETS.find(m => m.marketAddress.toLowerCase() === lower);
};

export function PendleWidgetPane(sharedProps: SharedProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const chainId = useChainId();
  const isOnPendleChain = isTestnetId(chainId) || chainId === mainnet.id;
  const [batchEnabled, setBatchEnabled] = useBatchToggle();

  const selectedMarketAddress = searchParams.get(QueryParams.Market);
  const selectedMarket = useMemo(() => findMarket(selectedMarketAddress), [selectedMarketAddress]);

  const { data: ptBalances } = usePendleUserPtBalances();

  // A market URL is only valid when it points at an active (non-matured)
  // entry in PENDLE_MARKETS. Matured markets only surface as redeem rows on
  // the overview, never as a detail view. Unknown addresses (typo/old
  // deployment) likewise fall through to overview.
  const showSelectedMarket = !!selectedMarket && !isMarketMatured(selectedMarket.expiry);

  // URL cleanup for matured/unknown markets is centralized in
  // validateSearchParams (called from MainApp) — same pattern as Vaults,
  // Convert, etc.

  // Partition into "My positions" (user holds PT) vs "All markets". Matured
  // markets are excluded from both — they live in PendleReadyToRedeemList.
  const [myMarkets, allMarkets] = useMemo(() => {
    const mine: PendleMarketConfig[] = [];
    const all: PendleMarketConfig[] = [];
    PENDLE_MARKETS.forEach(market => {
      if (isMarketMatured(market.expiry)) return;
      const heldBalance = ptBalances?.[market.marketAddress] ?? 0n;
      if (heldBalance > 0n) {
        mine.push(market);
      } else {
        all.push(market);
      }
    });
    return [mine, all];
  }, [ptBalances]);

  const handleSelectMarket = (market: PendleMarketConfig) => {
    setSearchParams(params => {
      params.set(QueryParams.PendleModule, PendleIntentMapping[PendleIntent.MARKET_INTENT]);
      params.set(QueryParams.Market, market.marketAddress);
      return params;
    });
  };

  const handleBack = () => {
    setSearchParams(params => {
      params.delete(QueryParams.PendleModule);
      params.delete(QueryParams.Market);
      return params;
    });
  };

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <CardAnimationWrapper
        key={showSelectedMarket ? selectedMarket!.marketAddress : 'overview'}
        className="h-full"
      >
        {showSelectedMarket ? (
          <PendleWidget
            {...sharedProps}
            market={selectedMarket!}
            onExternalLinkClicked={sharedProps.onExternalLinkClicked}
            onBackToPendle={handleBack}
            batchEnabled={batchEnabled}
            setBatchEnabled={setBatchEnabled}
          />
        ) : (
          <WidgetContainer
            header={
              <Heading variant="x-large">
                <Trans>Fixed Yield</Trans>
              </Heading>
            }
            subHeader={
              <Text className="text-textSecondary" variant="small">
                <Trans>
                  Lock in fixed yield by buying Principal Tokens (PT) at a discount. Each PT redeems 1:1 for
                  the underlying asset at maturity.
                </Trans>
              </Text>
            }
            rightHeader={sharedProps.rightHeaderComponent}
          >
            <div className="flex flex-col gap-4">
              {!isOnPendleChain && (
                <Text className="text-textSecondary">
                  <Trans>
                    Fixed yield markets are only on Ethereum mainnet. Switch networks to view markets.
                  </Trans>
                </Text>
              )}
              {isOnPendleChain && <PendleReadyToRedeemList />}
              {isOnPendleChain && myMarkets.length > 0 && (
                <motion.div className="space-y-3" variants={positionAnimations}>
                  <Heading tag="h3" variant="medium">
                    <Trans>My positions</Trans>
                  </Heading>
                  {myMarkets.map(market => (
                    <PendleMarketStatsCard
                      key={market.marketAddress}
                      market={market}
                      onClick={() => handleSelectMarket(market)}
                    />
                  ))}
                </motion.div>
              )}
              {isOnPendleChain && allMarkets.length > 0 && (
                <motion.div className="space-y-3" variants={positionAnimations}>
                  <Heading tag="h3" variant="medium">
                    <Trans>All markets</Trans>
                  </Heading>
                  {allMarkets.map(market => (
                    <PendleMarketStatsCard
                      key={market.marketAddress}
                      market={market}
                      onClick={() => handleSelectMarket(market)}
                    />
                  ))}
                </motion.div>
              )}
              {isOnPendleChain && myMarkets.length === 0 && allMarkets.length === 0 && (
                <Text className="text-textSecondary">
                  <Trans>No active fixed yield markets at the moment. Check back soon.</Trans>
                </Text>
              )}
            </div>
          </WidgetContainer>
        )}
      </CardAnimationWrapper>
    </AnimatePresence>
  );
}
