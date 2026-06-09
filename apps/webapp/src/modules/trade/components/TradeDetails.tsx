import { t } from '@lingui/core/macro';
import { TradeHistory } from './TradeHistory';
import { TradeFaq } from './TradeFaq';
import { DetailSectionWrapper } from '@/modules/ui/components/DetailSectionWrapper';
import { DetailSectionRow } from '@/modules/ui/components/DetailSectionRow';
import { DetailSection } from '@/modules/ui/components/DetailSection';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { AboutTokensCarousel } from './AboutTokensCarousel';

export function TradeDetails(): React.ReactElement {
  const { isConnectedAndAcceptedTerms } = useConnectedContext();

  return (
    <DetailSectionWrapper>
      {isConnectedAndAcceptedTerms && (
        <DetailSection title={t`Your Trade transaction history`}>
          <DetailSectionRow>
            <TradeHistory />
          </DetailSectionRow>
        </DetailSection>
      )}
      <DetailSection title={t`About Sky Ecosystem Tokens`}>
        <AboutTokensCarousel />
      </DetailSection>
      <DetailSection title={t`FAQs`}>
        <DetailSectionRow>
          <TradeFaq />
        </DetailSectionRow>
      </DetailSection>
    </DetailSectionWrapper>
  );
}
