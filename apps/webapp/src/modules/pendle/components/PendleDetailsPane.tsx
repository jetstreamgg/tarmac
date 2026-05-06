import { useMemo } from 'react';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useSearchParams } from 'react-router-dom';
import { useChainId, useConnection } from 'wagmi';
import {
  isMarketMatured,
  PENDLE_MARKETS,
  usePendleUserPtBalances,
  type PendleMarketConfig
} from '@jetstreamgg/sky-hooks';
import { isTestnetId } from '@jetstreamgg/sky-utils';
import { mainnet } from 'viem/chains';
import { PendleIntent } from '@/lib/enums';
import { PendleIntentMapping, QueryParams } from '@/lib/constants';
import { DetailSection } from '@/modules/ui/components/DetailSection';
import { DetailSectionRow } from '@/modules/ui/components/DetailSectionRow';
import { DetailSectionWrapper } from '@/modules/ui/components/DetailSectionWrapper';
import { Text } from '@/modules/layout/components/Typography';
import { PendleMarketStatsCard } from './PendleMarketStatsCard';
import { PendleAbout } from './PendleAbout';
import { PendleBalanceDetails } from './PendleBalanceDetails';
import { PendleMarketInfoCard } from './PendleMarketInfoCard';
import { TimeToMaturityCard } from './TimeToMaturityCard';
import { PendleMarketHistory } from './PendleMarketHistory';
import { PendleReadyToRedeemTable } from './PendleReadyToRedeemTable';

const findMarket = (address: string | null): PendleMarketConfig | undefined => {
  if (!address) return undefined;
  const lower = address.toLowerCase();
  return PENDLE_MARKETS.find(m => m.marketAddress.toLowerCase() === lower);
};

export const PendleDetailsPane = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const chainId = useChainId();
  const { address: userAddress } = useConnection();
  const isOnPendleChain = isTestnetId(chainId) || chainId === mainnet.id;

  const selectedMarketAddress = searchParams.get(QueryParams.Market);
  const selectedMarket = useMemo(() => findMarket(selectedMarketAddress), [selectedMarketAddress]);

  // A market URL is only valid when it points at an active (non-matured)
  // entry in PENDLE_MARKETS. Matured markets only surface as redeem rows on
  // the overview, never as a detail view. Unknown addresses (typo/old
  // deployment) likewise fall through to overview.
  const showSelectedMarket = !!selectedMarket && !isMarketMatured(selectedMarket.expiry);

  // URL cleanup for matured/unknown markets is centralized in PendleWidgetPane
  // (sibling pane). Doing it here too caused both setSearchParams calls to
  // race on the same render, with one stomping on the other.

  const handleSelectMarket = (market: PendleMarketConfig) => {
    setSearchParams(params => {
      params.set(QueryParams.PendleModule, PendleIntentMapping[PendleIntent.MARKET_INTENT]);
      params.set(QueryParams.Market, market.marketAddress);
      return params;
    });
  };
  const { data: ptBalances } = usePendleUserPtBalances();

  // Whether the user holds matured PT in any market — gates the overview
  // "Ready to redeem" section.
  const hasMaturedHoldings = !!(
    userAddress &&
    ptBalances &&
    PENDLE_MARKETS.some(m => isMarketMatured(m.expiry) && (ptBalances[m.marketAddress] ?? 0n) > 0n)
  );

  if (showSelectedMarket) {
    return (
      <DetailSectionWrapper>
        <DetailSection title={t`Your balances`}>
          <DetailSectionRow>
            <PendleBalanceDetails market={selectedMarket!} />
          </DetailSectionRow>
        </DetailSection>
        <DetailSection title={t`Market info`}>
          <DetailSectionRow>
            <PendleMarketInfoCard market={selectedMarket!} />
          </DetailSectionRow>
        </DetailSection>
        <DetailSection title={t`Time to maturity`}>
          <DetailSectionRow>
            <TimeToMaturityCard market={selectedMarket!} />
          </DetailSectionRow>
        </DetailSection>
        <DetailSection title={t`Your transaction history`}>
          <DetailSectionRow>
            <PendleMarketHistory market={selectedMarket!} />
          </DetailSectionRow>
        </DetailSection>
      </DetailSectionWrapper>
    );
  }

  // Overview. Available markets excludes matured — those live in
  // PendleReadyToRedeemTable, not as stats cards.
  const visibleMarkets = PENDLE_MARKETS.filter(market => !isMarketMatured(market.expiry));

  if (!isOnPendleChain) {
    return (
      <DetailSectionWrapper>
        <DetailSection title={t`Fixed Yield`}>
          <DetailSectionRow>
            <Text className="text-textSecondary">
              <Trans>
                Fixed yield markets are only available on Ethereum mainnet. Switch networks to view available
                markets.
              </Trans>
            </Text>
          </DetailSectionRow>
        </DetailSection>
        <DetailSection title={t`About`}>
          <DetailSectionRow>
            <PendleAbout />
          </DetailSectionRow>
        </DetailSection>
      </DetailSectionWrapper>
    );
  }

  return (
    <DetailSectionWrapper>
      {hasMaturedHoldings && (
        <DetailSection title={t`Ready to redeem`}>
          <DetailSectionRow>
            <PendleReadyToRedeemTable />
          </DetailSectionRow>
        </DetailSection>
      )}
      <DetailSection title={t`Available markets`}>
        <DetailSectionRow>
          {visibleMarkets.length === 0 ? (
            <Text className="text-textSecondary">
              <Trans>No active fixed yield markets at the moment. Check back soon.</Trans>
            </Text>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {visibleMarkets.map(market => (
                <PendleMarketStatsCard
                  key={market.marketAddress}
                  market={market}
                  onClick={() => handleSelectMarket(market)}
                />
              ))}
            </div>
          )}
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`About`}>
        <DetailSectionRow>
          <PendleAbout />
        </DetailSectionRow>
      </DetailSection>
    </DetailSectionWrapper>
  );
};
