import { useMemo } from 'react';
import { RewardsOverview } from './RewardsOverview';
import { RewardsDetailsView } from './RewardsDetailsView';
import { useRouteRewardContract } from '@/modules/rewards/hooks/useRouteRewardContract';
import { ActiveRewardsDetailsView } from '@/modules/rewards/helpers/rewards.constants';

export function RewardsDetailsPane() {
  const selectedRewardContract = useRouteRewardContract();
  const view = useMemo(
    () => (selectedRewardContract ? ActiveRewardsDetailsView.DETAILS : ActiveRewardsDetailsView.OVERVIEW),
    [selectedRewardContract]
  );

  return view === ActiveRewardsDetailsView.DETAILS ? (
    <RewardsDetailsView rewardContract={selectedRewardContract} />
  ) : (
    <RewardsOverview />
  );
}
