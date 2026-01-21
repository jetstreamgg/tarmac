import { Text } from '@/modules/layout/components/Typography';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { ModuleDisclaimer } from '@/modules/ui/components/ModuleDisclaimer';

export function ExpertRiskDisclaimer() {
  const {
    setExpertRiskDisclaimerShown,
    expertRiskDisclaimerShown,
    expertRiskDisclaimerDismissed,
    updateUserConfig,
    userConfig
  } = useConfigContext();

  const handleDismiss = () => {
    // Update both dismissed and shown flags in a single update to avoid race conditions
    updateUserConfig({
      ...userConfig,
      expertRiskDisclaimerDismissed: true,
      expertRiskDisclaimerShown: true
    });
  };

  return (
    <ModuleDisclaimer
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
      onShow={() => setExpertRiskDisclaimerShown(true)}
      isDismissed={expertRiskDisclaimerDismissed}
      onDismiss={handleDismiss}
    />
  );
}
