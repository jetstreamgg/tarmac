import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { ModuleDisclaimer } from '@/modules/ui/components/ModuleDisclaimer';

const DISCLAIMER_DISMISSED_KEY = 'staking-rewards-disclaimer-dismissed';

export function StakingRewardsDisclaimer() {
  const { stakingRewardsDisclaimerShown, setStakingRewardsDisclaimerShown } = useConfigContext();

  return (
    <ModuleDisclaimer
      moduleKey={DISCLAIMER_DISMISSED_KEY}
      isShown={stakingRewardsDisclaimerShown}
      dataTestId="staking-rewards-disclaimer"
      dismissButtonTestId="staking-rewards-dismiss"
      type="info"
      text="USDS rewards have been disabled and SKY has been added as a Staking Reward option."
      setIsShown={setStakingRewardsDisclaimerShown}
    />
  );
}
