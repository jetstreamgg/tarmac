import { IntentMapping, QueryParams, REFRESH_DELAY } from '@/lib/constants';
import { Intent } from '@/lib/enums';
import { useSubgraphUrl } from '@/modules/app/hooks/useSubgraphUrl';
import { SharedProps } from '@/modules/app/types/Widgets';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { RewardContract, useRewardsUserHistory } from '@/hooks';
import { RewardsAction, RewardsFlow, RewardsWidget, TxStatus, WidgetStateChangeParams } from '@/widgets';
import { useSearchParams } from 'react-router-dom';
import { RewardsUsdsSkyDisclaimer } from './RewardsUsdsSkyDisclaimer';

export function RewardsWidgetPane(sharedProps: SharedProps) {
  const subgraphUrl = useSubgraphUrl();
  const { selectedRewardContract, setSelectedRewardContract } = useConfigContext();
  const { mutate: refreshRewardsHistory } = useRewardsUserHistory({
    rewardContractAddress: selectedRewardContract?.contractAddress || '',
    subgraphUrl
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const flow = (searchParams.get(QueryParams.Flow) || undefined) as RewardsFlow | undefined;

  const onRewardContractChange = (rewardContract?: RewardContract) => {
    // Prevent race conditions
    if (searchParams.get(QueryParams.Widget) !== IntentMapping[Intent.REWARDS_INTENT]) {
      return;
    }

    setSearchParams(
      params => {
        if (rewardContract?.contractAddress) {
          params.set(QueryParams.Widget, IntentMapping[Intent.REWARDS_INTENT]);
          params.set(QueryParams.Reward, rewardContract.contractAddress);
        } else {
          params.delete(QueryParams.Reward);
        }
        return params;
      },
      { replace: true }
    );
    setSelectedRewardContract(rewardContract);
  };

  const onRewardsWidgetStateChange = ({
    hash,
    txStatus,
    widgetState,
    originAmount
  }: WidgetStateChangeParams) => {
    // Prevent race conditions
    if (searchParams.get(QueryParams.Widget) !== IntentMapping[Intent.REWARDS_INTENT]) {
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

    // Update amount in URL if provided and not zero
    if (originAmount && originAmount !== '0') {
      setSearchParams(
        prev => {
          prev.set(QueryParams.InputAmount, originAmount);
          return prev;
        },
        { replace: true }
      );
    } else if (originAmount === '') {
      setSearchParams(
        prev => {
          prev.delete(QueryParams.InputAmount);
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
      {...sharedProps}
      onRewardContractChange={onRewardContractChange}
      externalWidgetState={{ selectedRewardContract, flow }}
      onWidgetStateChange={onRewardsWidgetStateChange}
      disclaimer={<RewardsUsdsSkyDisclaimer />}
    />
  );
}
