import { IntentMapping, QueryParams, REFRESH_DELAY } from '@/lib/constants';
import { Intent } from '@/lib/enums';
import { useSubgraphUrl } from '@/modules/app/hooks/useSubgraphUrl';
import { SharedProps } from '@/modules/app/types/Widgets';
import { useChatContext } from '@/modules/chat/context/ChatContext';
import { LinkedActionSteps } from '@/modules/config/context/ConfigContext';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';
import { deleteSearchParams } from '@/modules/utils/deleteSearchParams';
import { RewardContract, useRewardsUserHistory } from '@jetstreamgg/sky-hooks';
import {
  RewardsAction,
  RewardsFlow,
  RewardsWidget,
  TxStatus,
  WidgetStateChangeParams
} from '@jetstreamgg/sky-widgets';
import { useSearchParams } from 'react-router-dom';
import { RewardsUsdsSkyDisclaimer } from './RewardsUsdsSkyDisclaimer';

export function RewardsWidgetPane(sharedProps: SharedProps) {
  const subgraphUrl = useSubgraphUrl();
  const { setShouldDisableActionButtons } = useChatContext();
  const [batchEnabled, setBatchEnabled] = useBatchToggle();
  const {
    selectedRewardContract,
    setSelectedRewardContract,
    linkedActionConfig,
    updateLinkedActionConfig,
    exitLinkedActionMode
  } = useConfigContext();
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

    setShouldDisableActionButtons(txStatus === TxStatus.INITIALIZED);

    // Set flow search param based on widgetState.flow
    if (widgetState.flow) {
      setSearchParams(
        prev => {
          prev.set(QueryParams.Flow, widgetState.flow);
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

    // After a successful linked action supply, set the step to "success"
    if (
      widgetState.action === RewardsAction.SUPPLY &&
      txStatus === TxStatus.SUCCESS &&
      linkedActionConfig.step === LinkedActionSteps.COMPLETED_CURRENT
    ) {
      updateLinkedActionConfig({ step: LinkedActionSteps.COMPLETED_SUCCESS });
    }

    // Reset the linked action state and URL params after clicking "finish"
    if (txStatus === TxStatus.IDLE && linkedActionConfig.step === LinkedActionSteps.COMPLETED_SUCCESS) {
      exitLinkedActionMode();
      setSearchParams(
        (prevParams: URLSearchParams) => {
          const params = deleteSearchParams(prevParams);
          return params;
        },
        { replace: true }
      );
    }

    if (
      hash &&
      txStatus === TxStatus.SUCCESS &&
      [RewardsAction.SUPPLY, RewardsAction.WITHDRAW].includes(widgetState.action)
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
      externalWidgetState={{ selectedRewardContract, amount: linkedActionConfig?.inputAmount, flow }}
      onWidgetStateChange={onRewardsWidgetStateChange}
      batchEnabled={batchEnabled}
      setBatchEnabled={setBatchEnabled}
      disclaimer={<RewardsUsdsSkyDisclaimer />}
    />
  );
}
