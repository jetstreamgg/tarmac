import {
  TradeWidget,
  TxStatus,
  TradeAction,
  WidgetStateChangeParams,
  L2TradeWidget
} from '@jetstreamgg/sky-widgets';
import { defaultConfig } from '../../config/default-config';
import { useChainId, useConfig as useWagmiConfig } from 'wagmi';
import { IntentMapping, QueryParams, REFRESH_DELAY } from '@/lib/constants';
import { SharedProps } from '@/modules/app/types/Widgets';
import { LinkedActionSteps } from '@/modules/config/context/ConfigContext';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { useCustomNavigation } from '@/modules/ui/hooks/useCustomNavigation';
import { capitalizeFirstLetter } from '@/lib/helpers/string/capitalizeFirstLetter';
import { useSearchParams } from 'react-router-dom';
import { updateParamsFromTransaction } from '@/modules/utils/updateParamsFromTransaction';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { getChainSpecificText, isCowSupportedChainId } from '@jetstreamgg/sky-utils';
import { useChatContext } from '@/modules/chat/context/ChatContext';
import { Intent } from '@/lib/enums';
import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';

export function TradeWidgetPane(sharedProps: SharedProps) {
  const chainId = useChainId();

  const queryClient = useQueryClient();
  const { linkedActionConfig, updateLinkedActionConfig } = useConfigContext();

  const wagmiConfig = useWagmiConfig();
  const [searchParams, setSearchParams] = useSearchParams();

  const { onNavigate, setCustomHref, customNavLabel, setCustomNavLabel } = useCustomNavigation();
  const isCowSupported = isCowSupportedChainId(chainId);
  const { setShouldDisableActionButtons } = useChatContext();

  const [batchEnabled, setBatchEnabled] = useBatchToggle();

  const onTradeWidgetStateChange = ({
    hash,
    txStatus,
    widgetState,
    originToken,
    targetToken,
    executedBuyAmount,
    originAmount
  }: WidgetStateChangeParams) => {
    // Prevent race conditions
    if (searchParams.get(QueryParams.Widget) !== IntentMapping[Intent.TRADE_INTENT]) {
      return;
    }

    setShouldDisableActionButtons(txStatus === TxStatus.INITIALIZED);

    // Update search params
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

    if (originToken) {
      setSearchParams(
        prev => {
          prev.set(QueryParams.SourceToken, originToken);
          return prev;
        },
        { replace: true }
      );
    } else if (originToken === '') {
      setSearchParams(
        prev => {
          prev.delete(QueryParams.SourceToken);
          return prev;
        },
        { replace: true }
      );
    }

    if (targetToken) {
      setSearchParams(
        prev => {
          prev.set(QueryParams.TargetToken, targetToken);
          return prev;
        },
        { replace: true }
      );
    } else if (targetToken === '') {
      setSearchParams(
        prev => {
          prev.delete(QueryParams.TargetToken);
          return prev;
        },
        { replace: true }
      );
    }

    // After a successful trade, set the linked action step to "success"
    if (
      widgetState.action === TradeAction.TRADE &&
      txStatus === TxStatus.SUCCESS &&
      linkedActionConfig.step === LinkedActionSteps.CURRENT_FUTURE
    ) {
      updateLinkedActionConfig({ step: LinkedActionSteps.SUCCESS_FUTURE });
    }

    if (
      widgetState.action === TradeAction.TRADE &&
      (txStatus === TxStatus.LOADING || txStatus === TxStatus.SUCCESS)
    ) {
      setTimeout(() => {
        if (isCowSupported) {
          queryClient.invalidateQueries({ queryKey: ['cowswap-trade-history'] });
        } else {
          queryClient.invalidateQueries({ queryKey: ['psm-trade-history'] });
        }
      }, REFRESH_DELAY);
    }

    if (
      hash &&
      txStatus === TxStatus.SUCCESS &&
      widgetState.action === TradeAction.TRADE &&
      linkedActionConfig?.linkedAction
    ) {
      updateParamsFromTransaction(hash, wagmiConfig, setSearchParams);
      setTimeout(() => {
        if (isCowSupported) {
          queryClient.invalidateQueries({ queryKey: ['cowswap-trade-history'] });
        } else {
          queryClient.invalidateQueries({ queryKey: ['psm-trade-history'] });
        }
      }, REFRESH_DELAY);
    }

    // When we're ready to proceed with the next LA step, set the href & nav label accordingly
    if (
      txStatus === TxStatus.SUCCESS &&
      widgetState.action === TradeAction.TRADE &&
      linkedActionConfig?.linkedAction &&
      linkedActionConfig.step === LinkedActionSteps.SUCCESS_FUTURE
    ) {
      const widget = linkedActionConfig.linkedAction;
      const reward = linkedActionConfig.rewardContract
        ? `&${QueryParams.Reward}=${linkedActionConfig.rewardContract}`
        : '';
      const expertModule = linkedActionConfig.expertModule
        ? `&${QueryParams.ExpertModule}=${linkedActionConfig.expertModule}`
        : '';
      setCustomHref(
        `/?${QueryParams.Widget}=${widget}&${QueryParams.InputAmount}=${executedBuyAmount}&${QueryParams.LinkedAction}=${widget}${reward}${expertModule}`
      );
      setCustomNavLabel(`Go to ${capitalizeFirstLetter(linkedActionConfig.linkedAction)}`);
    } else {
      setCustomHref(undefined);
      setCustomNavLabel(undefined);
    }
  };

  const externalWidgetState = useMemo(
    () => ({
      amount: linkedActionConfig?.inputAmount,
      token: linkedActionConfig?.sourceToken?.toUpperCase(),
      targetToken: linkedActionConfig?.targetToken?.toUpperCase(),
      timestamp: linkedActionConfig?.timestamp ? Number(linkedActionConfig?.timestamp) : undefined
    }),
    [linkedActionConfig]
  );

  const Widget = isCowSupported ? TradeWidget : L2TradeWidget;

  const shouldLockTokens =
    linkedActionConfig.showLinkedAction &&
    !!linkedActionConfig.sourceToken &&
    !!linkedActionConfig.targetToken;
  return (
    <Widget
      key={externalWidgetState.timestamp}
      {...sharedProps}
      disallowedPairs={defaultConfig.tradeDisallowedPairs}
      customTokenList={defaultConfig.tradeTokenList[chainId]}
      onWidgetStateChange={onTradeWidgetStateChange}
      customNavigationLabel={customNavLabel}
      onCustomNavigation={onNavigate}
      externalWidgetState={externalWidgetState}
      widgetTitle={getChainSpecificText(
        {
          base: 'Base Trade',
          arbitrum: 'Arbitrum Trade',
          optimism: 'Optimism Trade',
          unichain: 'Unichain Trade',
          default: 'Trade'
        },
        chainId
      )}
      batchEnabled={batchEnabled}
      setBatchEnabled={setBatchEnabled}
      tokensLocked={shouldLockTokens}
    />
  );
}
