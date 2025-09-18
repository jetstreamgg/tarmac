import { t } from '@lingui/core/macro';
import { TradeHistory } from './TradeHistory';
import { TradeFaq } from './TradeFaq';
import { DetailSectionWrapper } from '@/modules/ui/components/DetailSectionWrapper';
import { DetailSectionRow } from '@/modules/ui/components/DetailSectionRow';
import { DetailSection } from '@/modules/ui/components/DetailSection';
import { AboutUsds } from '@/modules/ui/components/AboutUsds';
import { ActionsShowcase } from '@/modules/ui/components/ActionsShowcase';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { IntentMapping } from '@/lib/constants';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { useUserSuggestedActions } from '@/modules/ui/hooks/useUserSuggestedActions';
import { filterActionsByIntent } from '@/lib/utils';
import { StarTokenDetails } from './StarTokenDetails';

export function TradeDetails(): React.ReactElement {
  const { isConnectedAndAcceptedTerms } = useConnectedContext();
  const { linkedActionConfig } = useConfigContext();
  const { data: actionData } = useUserSuggestedActions();
  const widget = IntentMapping.TRADE_INTENT;

  return (
    <DetailSectionWrapper>
      {isConnectedAndAcceptedTerms &&
        !linkedActionConfig?.showLinkedAction &&
        (filterActionsByIntent(actionData?.linkedActions || [], widget).length ?? 0) > 0 && (
          <DetailSection title={t`Combined actions`}>
            <DetailSectionRow>
              <ActionsShowcase widget={widget} />
            </DetailSectionRow>
          </DetailSection>
        )}
      <DetailSection title={t`Star Ecosystem Tokens`}>
        <DetailSectionRow>
          <StarTokenDetails />
        </DetailSectionRow>
      </DetailSection>
      <DetailSection title={t`About Native Sky Protocol Tokens`}>
        <DetailSectionRow>
          <AboutUsds />
        </DetailSectionRow>
      </DetailSection>
      {isConnectedAndAcceptedTerms && (
        <DetailSection title={t`Your Trade transaction history`}>
          <DetailSectionRow>
            <TradeHistory />
          </DetailSectionRow>
        </DetailSection>
      )}
      <DetailSection title={t`FAQs`}>
        <DetailSectionRow>
          <TradeFaq />
        </DetailSectionRow>
      </DetailSection>
    </DetailSectionWrapper>
  );
}
