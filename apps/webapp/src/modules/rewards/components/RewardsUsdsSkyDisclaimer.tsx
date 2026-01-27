import { ModuleDisclaimer } from '@/modules/ui/components/ModuleDisclaimer';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';

export function RewardsUsdsSkyDisclaimer() {
  const { rewardsUsdsSkyDisclaimerDismissed, setRewardsUsdsSkyDisclaimerDismissed } = useConfigContext();

  return (
    <ModuleDisclaimer
      dataTestId="rewards-usds-sky-disclaimer"
      dismissButtonTestId="rewards-usds-sky-disclaimer-dismiss"
      type="info"
      text="SKY Rewards have been disabled and other reward options are available."
      isDismissed={rewardsUsdsSkyDisclaimerDismissed}
      onDismiss={() => setRewardsUsdsSkyDisclaimerDismissed(true)}
    />
  );
}
