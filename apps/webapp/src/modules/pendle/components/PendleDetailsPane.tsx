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
import { QueryParams } from '@/lib/constants';
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
  const [searchParams] = useSearchParams();
  const chainId = useChainId();
  const { address: userAddress } = useConnection();
  const isOnPendleChain = isTestnetId(chainId) || chainId === mainnet.id;

  const selectedMarket = findMarket(searchParams.get(QueryParams.Market));
  const { data: ptBalances } = usePendleUserPtBalances();

  // Whether the user holds matured PT in any market — gates the overview
  // "Ready to redeem" section.
  const hasMaturedHoldings = !!(
    userAddress &&
    ptBalances &&
    PENDLE_MARKETS.some(
      m => isMarketMatured(m.expiry) && (ptBalances[m.marketAddress] ?? 0n) > 0n
    )
  );

  if (selectedMarket) {
    // Per-market view: only show the redeem table when THIS market is matured
    // and held by the user. Filter the table to just that one row so the user
    // doesn't see unrelated markets while focused on this one.
    const selectedIsMatured = isMarketMatured(selectedMarket.expiry);
    const selectedBalance = ptBalances?.[selectedMarket.marketAddress] ?? 0n;
    const showSelectedRedeem = !!userAddress && selectedIsMatured && selectedBalance > 0n;

    return (
      <DetailSectionWrapper>
        <DetailSection title={t`Your balances`}>
          <DetailSectionRow>
            <PendleBalanceDetails market={selectedMarket} />
          </DetailSectionRow>
        </DetailSection>
        {showSelectedRedeem && (
          <DetailSection title={t`Ready to redeem`}>
            <DetailSectionRow>
              <PendleReadyToRedeemTable marketFilter={selectedMarket} />
            </DetailSectionRow>
          </DetailSection>
        )}
        <DetailSection title={t`Market info`}>
          <DetailSectionRow>
            <PendleMarketInfoCard market={selectedMarket} />
          </DetailSectionRow>
        </DetailSection>
        <DetailSection title={t`Time to maturity`}>
          <DetailSectionRow>
            <TimeToMaturityCard market={selectedMarket} />
          </DetailSectionRow>
        </DetailSection>
        <DetailSection title={t`Your transaction history`}>
          <DetailSectionRow>
            <PendleMarketHistory market={selectedMarket} />
          </DetailSectionRow>
        </DetailSection>
      </DetailSectionWrapper>
    );
  }

  // Overview (no market selected). Show available markets, gated by maturity / hold rule.
  const visibleMarkets = PENDLE_MARKETS.filter(market => {
    if (!isMarketMatured(market.expiry)) return true;
    if (!userAddress) return false;
    const heldBalance = ptBalances?.[market.marketAddress];
    return heldBalance !== undefined && heldBalance > 0n;
  });

  if (!isOnPendleChain) {
    return (
      <DetailSectionWrapper>
        <DetailSection title={t`Pendle fixed yield`}>
          <DetailSectionRow>
            <Text className="text-textSecondary">
              <Trans>
                Pendle markets are only available on Ethereum mainnet. Switch networks to view available
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
              <Trans>No active Pendle markets at the moment. Check back soon.</Trans>
            </Text>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visibleMarkets.map(market => (
                <PendleMarketStatsCard key={market.marketAddress} market={market} />
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
