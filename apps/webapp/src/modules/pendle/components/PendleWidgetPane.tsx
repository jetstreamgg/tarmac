import { useEffect, useMemo, useReducer } from 'react';
import { Trans } from '@lingui/react/macro';
import { useNavigate } from '@tanstack/react-router';
import { keepSearch, useRouteEntityParams } from '@/lib/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { useChainId } from 'wagmi';
import { mainnet } from 'viem/chains';
import { isMarketMatured, PENDLE_MARKETS, usePendleUserPtBalances, type PendleMarketConfig } from '@/hooks';
import { isTestnetId } from '@/utils';
import { CardAnimationWrapper, PendleWidget, WidgetContainer, positionAnimations } from '@/widgets';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { PendleMarketStatsCard } from './PendleMarketStatsCard';
import { PendleReadyToRedeemList } from './PendleReadyToRedeemList';

const findMarket = (address: string | null): PendleMarketConfig | undefined => {
  if (!address) return undefined;
  const lower = address.toLowerCase();
  return PENDLE_MARKETS.find(m => m.marketAddress.toLowerCase() === lower);
};

export function PendleWidgetPane() {
  const navigate = useNavigate();
  const chainId = useChainId();
  const isOnPendleChain = isTestnetId(chainId) || chainId === mainnet.id;

  const selectedMarketAddress = useRouteEntityParams().marketAddress ?? null;
  const selectedMarket = useMemo(() => findMarket(selectedMarketAddress), [selectedMarketAddress]);

  const { data: ptBalances } = usePendleUserPtBalances();

  // A market URL is only valid when it points at an active (non-matured)
  // entry in PENDLE_MARKETS. Matured markets only surface as redeem rows on
  // the overview, never as a detail view. Unknown addresses (typo/old
  // deployment) likewise fall through to overview.
  const showSelectedMarket = !!selectedMarket && !isMarketMatured(selectedMarket.expiry);

  // Force a re-render at expiry so the user is bumped out of a market that matures while open.
  const [, tick] = useReducer(x => x + 1, 0);
  useEffect(() => {
    if (!selectedMarket) return;
    const ms = selectedMarket.expiry * 1000 - Date.now();
    if (ms <= 0 || ms > 2_147_483_000) return;
    const id = setTimeout(tick, ms);
    return () => clearTimeout(id);
  }, [selectedMarket?.marketAddress, selectedMarket?.expiry]);

  // URL cleanup for matured/unknown markets lives in the /fixed/market route's
  // beforeLoad, which falls back to the overview.

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
    void navigate({
      to: '/fixed/market/$marketAddress',
      params: { marketAddress: market.marketAddress },
      search: keepSearch
    });
  };

  const handleBack = () => {
    void navigate({ to: '/fixed', search: keepSearch });
  };

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <CardAnimationWrapper
        key={showSelectedMarket ? selectedMarket!.marketAddress : 'overview'}
        className="h-full"
      >
        {showSelectedMarket ? (
          <PendleWidget market={selectedMarket!} onBackToPendle={handleBack} />
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
                  Know your return by a pre-set maturity date. Supply USDS at a discount. Redeem for full USDS
                  value at maturity.
                </Trans>
              </Text>
            }
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
