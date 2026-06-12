import { QueryParams, REFRESH_DELAY } from '@/lib/constants';
import { Intent } from '@/lib/enums';
import { useNavigate } from '@tanstack/react-router';
import { useSubgraphUrl } from '@/modules/app/hooks/useSubgraphUrl';
import { RewardContract, useRewardsUserHistory } from '@/hooks';
import { RewardsAction, RewardsFlow, RewardsWidget, TxStatus, WidgetStateChangeParams } from '@/widgets';
import { keepSearch, useAppSearchParams, useRouteIntent } from '@/lib/navigation';
import { useRouteRewardContract } from '@/modules/rewards/hooks/useRouteRewardContract';
import { RewardsUsdsSkyDisclaimer } from './RewardsUsdsSkyDisclaimer';

export function RewardsWidgetPane() {
  const subgraphUrl = useSubgraphUrl();
  const selectedRewardContract = useRouteRewardContract();
  const { mutate: refreshRewardsHistory } = useRewardsUserHistory({
    rewardContractAddress: selectedRewardContract?.contractAddress || '',
    subgraphUrl
  });

  const [searchParams, setSearchParams] = useAppSearchParams();
  const navigate = useNavigate();
  const intent = useRouteIntent();
  const flow = (searchParams.get(QueryParams.Flow) || undefined) as RewardsFlow | undefined;

  const onRewardContractChange = (rewardContract?: RewardContract) => {
    // Prevent race conditions
    if (intent !== Intent.REWARDS_INTENT) {
      return;
    }

    if (rewardContract?.contractAddress) {
      void navigate({
        to: '/rewards/$rewardContract',
        params: { rewardContract: rewardContract.contractAddress },
        search: keepSearch,
        replace: true
      });
    } else {
      void navigate({ to: '/rewards', search: keepSearch, replace: true });
    }
  };

  const onRewardsWidgetStateChange = ({ hash, txStatus, widgetState }: WidgetStateChangeParams) => {
    // Prevent race conditions
    if (intent !== Intent.REWARDS_INTENT) {
      return;
    }

    // Set flow search param based on widgetState.flow
    const { flow } = widgetState;
    if (flow) {
      setSearchParams(
        prev => {
          prev.set(QueryParams.Flow, flow);
          return prev;
        },
        { replace: true }
      );
    }

    if (
      hash &&
      txStatus === TxStatus.SUCCESS &&
      [RewardsAction.SUPPLY, RewardsAction.WITHDRAW].includes(widgetState.action as RewardsAction)
    ) {
      setTimeout(() => {
        refreshRewardsHistory();
      }, REFRESH_DELAY);
    }
  };

  return (
    <RewardsWidget
      onRewardContractChange={onRewardContractChange}
      externalWidgetState={{ selectedRewardContract, flow }}
      onWidgetStateChange={onRewardsWidgetStateChange}
      disclaimer={<RewardsUsdsSkyDisclaimer />}
    />
  );
}
