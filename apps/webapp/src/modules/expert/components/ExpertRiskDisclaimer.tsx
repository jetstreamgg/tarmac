import { Text } from '@/modules/layout/components/Typography';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { ModuleDisclaimer } from '@/modules/ui/components/ModuleDisclaimer';

const DISCLAIMER_DISMISSED_KEY = 'expert-risk-disclaimer-dismissed';

export function ExpertRiskDisclaimer() {
  const { setExpertRiskDisclaimerShown, expertRiskDisclaimerShown } = useConfigContext();

  return (
    <ModuleDisclaimer
      moduleKey={DISCLAIMER_DISMISSED_KEY}
      isShown={expertRiskDisclaimerShown}
      dataTestId="expert-risk-disclaimer"
      dismissButtonTestId="expert-risk-dismiss"
      type="warning"
      text={
        <Text variant="medium" dataTestId="expert-risk-disclaimer">
          Expert modules are intended for experienced users and may function differently than modules to which
          ordinary users are accustomed. Please be sure you understand the unique features and the associated
          risks of any Expert Module before proceeding. Be sure to review the FAQs and{' '}
          <ExternalLink
            href="https://docs.sky.money/user-risks"
            showIcon={false}
            className="text-textEmphasis"
          >
            User Risks
          </ExternalLink>
          .
        </Text>
      }
      setIsShown={setExpertRiskDisclaimerShown}
    />
  );
}
