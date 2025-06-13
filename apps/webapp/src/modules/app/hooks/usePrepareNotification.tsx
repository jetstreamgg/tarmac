import { useToast } from '@/components/ui/use-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { IntentMapping, QueryParams } from '@/lib/constants';
import { LinkedAction, useUserSuggestedActions } from '@/modules/ui/hooks/useUserSuggestedActions';
import { Intent } from '@/lib/enums';
import { useRetainedQueryParams } from '@/modules/ui/hooks/useRetainedQueryParams';
import { useCallback, useMemo } from 'react';
import { useAvailableTokenRewardContracts } from '@jetstreamgg/sky-hooks';
import { useChainId } from 'wagmi';
import { formatDecimalPercentage, isL2ChainId } from '@jetstreamgg/sky-utils';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { useOverallSkyData } from '@jetstreamgg/sky-hooks';

export const usePrepareNotification = () => {
  const chainId = useChainId();
  const { selectedRewardContract } = useConfigContext();
  const [searchParams] = useSearchParams();
  const widgetParam = searchParams.get(QueryParams.Widget);
  const { data } = useUserSuggestedActions();
  const isSavingsModule = widgetParam === IntentMapping[Intent.SAVINGS_INTENT];
  const isRewardsModule = widgetParam === IntentMapping[Intent.REWARDS_INTENT];
  const isUpgradeModule = widgetParam === IntentMapping[Intent.UPGRADE_INTENT];
  const isTradeModule = widgetParam === IntentMapping[Intent.TRADE_INTENT];
  const isL2 = isL2ChainId(chainId);
  const { dismiss } = useToast();
  const navigate = useNavigate();

  const rewardContracts = useAvailableTokenRewardContracts(chainId);
  const rewardContract = rewardContracts.find(
    rewardContract =>
      rewardContract?.contractAddress?.toLowerCase() ===
      selectedRewardContract?.contractAddress?.toLowerCase()
  );

  const { data: skyData } = useOverallSkyData();
  const savingsRate = skyData && formatDecimalPercentage(parseFloat(skyData?.skySavingsRatecRate || '0'));
  const rewardsRate = skyData && formatDecimalPercentage(parseFloat(skyData?.usdsSkyCRate || '0'));

  const action = useMemo(() => {
    if (!isSavingsModule && !isRewardsModule) return;

    const la = data?.linkedActions.find(
      action =>
        (isSavingsModule || isRewardsModule) &&
        action.intent === IntentMapping[Intent.UPGRADE_INTENT] &&
        action.la === IntentMapping[isSavingsModule ? Intent.SAVINGS_INTENT : Intent.REWARDS_INTENT]
    );
    const sa = data?.suggestedActions.find(
      action => action.intent === IntentMapping[Intent.UPGRADE_INTENT] && action.primaryToken === 'USDS'
    );
    return la || sa;
  }, [data, isSavingsModule, isRewardsModule]);

  // Rewards LA should return the user to the current reward contract
  const url = useRetainedQueryParams(
    isRewardsModule && (action as LinkedAction)?.la === IntentMapping.REWARDS_INTENT
      ? action?.url?.includes('reward=')
        ? action.url.replace(/(reward=)[^&]+/, `$1${rewardContract}`)
        : `${action?.url || ''}&${QueryParams.Reward}=${rewardContract}`
      : action?.url || ''
  );

  // After an upgrade to USDS, the user should be redirected to the rewards page
  const upgradeAction = useMemo(() => {
    if (isUpgradeModule) {
      return data?.suggestedActions.find(action => action.intent === IntentMapping[Intent.REWARDS_INTENT]);
    }
  }, [data, isUpgradeModule]);

  // We don't send them to a single reward contract but to the overview page
  const upgradeUrl = useRetainedQueryParams(
    isUpgradeModule && upgradeAction
      ? upgradeAction?.url?.replace(/&reward=0x[a-fA-F0-9]+/, '')
      : action?.url || ''
  );

  // After a trade, the user should be redirected to Upgrade and Get Rewards LA
  const tradeAction = useMemo(() => {
    if (isTradeModule) {
      return (
        data?.linkedActions.find(
          action =>
            action.intent === IntentMapping[Intent.UPGRADE_INTENT] &&
            action.la === IntentMapping[Intent.REWARDS_INTENT]
        ) || data?.suggestedActions.find(action => action.intent === IntentMapping[Intent.REWARDS_INTENT])
      );
    }
  }, [data, isTradeModule]);

  // We don't send them to a single reward contract but to the overview page
  let tradeUrlValue = '';
  if (isTradeModule) {
    if (isL2) {
      tradeUrlValue = `/?widget=${IntentMapping[Intent.SAVINGS_INTENT]}`;
    } else {
      tradeUrlValue = `/?widget=${IntentMapping[Intent.REWARDS_INTENT]}`;
    }
  } else {
    tradeUrlValue = action?.url || '';
  }

  const tradeUrl = useRetainedQueryParams(tradeUrlValue);

  const navigateCallback = useCallback(() => {
    const targetUrl = isUpgradeModule ? upgradeUrl : isTradeModule ? tradeUrl : url;

    if (targetUrl) {
      navigate(targetUrl);
      dismiss();
    }
  }, [url, upgradeUrl, tradeUrl, navigate, dismiss, isUpgradeModule, isTradeModule]);

  return {
    url: isUpgradeModule ? upgradeUrl : isTradeModule ? tradeUrl : url,
    navigate: navigateCallback,
    action: upgradeAction || tradeAction || action,
    rewardContract,
    rewardContractRate: rewardsRate,
    savingsRate,
    isSavingsModule,
    isRewardsModule,
    isTradeModule,
    isUpgradeModule
  };
};
