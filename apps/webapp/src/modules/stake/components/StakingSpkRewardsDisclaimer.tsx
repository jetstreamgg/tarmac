import { ModuleDisclaimer } from '@/modules/ui/components/ModuleDisclaimer';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';

export function StakingSpkRewardsDisclaimer() {
  const { stakingSpkDisclaimerDismissed, setStakingSpkDisclaimerDismissed } = useConfigContext();

  return (
    <ModuleDisclaimer
      dataTestId="staking-spk-rewards-disclaimer"
      dismissButtonTestId="staking-spk-rewards-dismiss"
      type="info"
      text="SPK rewards have been disabled as a Staking Reward option."
      isDismissed={stakingSpkDisclaimerDismissed}
      onDismiss={() => setStakingSpkDisclaimerDismissed(true)}
    />
  );
}
