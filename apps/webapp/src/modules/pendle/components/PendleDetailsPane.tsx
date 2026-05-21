import { useMemo } from 'react';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useSearchParams } from 'react-router-dom';
import { useChainId, useConnection } from 'wagmi';
import { isMarketMatured, PENDLE_MARKETS, usePendleUserPtBalances, type PendleMarketConfig } from '@/hooks';
import { isTestnetId } from '@/utils';
import { mainnet } from 'viem/chains';
import { QueryParams } from '@/lib/constants';
import { DetailSection } from '@/modules/ui/components/DetailSection';
import { DetailSectionRow } from '@/modules/ui/components/DetailSectionRow';
import { DetailSectionWrapper } from '@/modules/ui/components/DetailSectionWrapper';
import { Text } from '@/modules/layout/components/Typography';
import { PendleAbout } from './PendleAbout';
import { PendleBalanceDetails } from './PendleBalanceDetails';
import { PendleMarketInfoCard } from './PendleMarketInfoCard';
import { TimeToMaturityCard } from './TimeToMaturityCard';
import { PendleMarketHistory } from './PendleMarketHistory';
import { PendleAllMarketsHistory } from './PendleAllMarketsHistory';
import { PendleReadyToRedeemTable } from './PendleReadyToRedeemTable';
import { PendleFaq } from './PendleFaq';

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

  const selectedMarketAddress = searchParams.get(QueryParams.Market);
  const selectedMarket = useMemo(() => findMarket(selectedMarketAddress), [selectedMarketAddress]);

  const showSelectedMarket = !!selectedMarket && !isMarketMatured(selectedMarket.expiry);

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
        <DetailSection title={t`FAQs`}>
          <DetailSectionRow>
            <PendleFaq />
          </DetailSectionRow>
        </DetailSection>
      </DetailSectionWrapper>
    );
  }

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
        <DetailSection title={t`FAQs`}>
          <DetailSectionRow>
            <PendleFaq />
          </DetailSectionRow>
        </DetailSection>
      </DetailSectionWrapper>
    );
  }

  return (
    <DetailSectionWrapper>
      {hasMaturedHoldings && (
        <DetailSection title={t`Your matured positions`}>
          <DetailSectionRow>
            <PendleReadyToRedeemTable />
          </DetailSectionRow>
        </DetailSection>
      )}
      <DetailSection title={t`Your transaction history`}>
        <DetailSectionRow>
          <PendleAllMarketsHistory />
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`About`}>
        <DetailSectionRow>
          <PendleAbout />
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`FAQs`}>
        <DetailSectionRow>
          <PendleFaq />
        </DetailSectionRow>
      </DetailSection>
    </DetailSectionWrapper>
  );
};
