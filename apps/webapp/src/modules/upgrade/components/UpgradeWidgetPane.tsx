import { useSearchParams } from 'react-router-dom';

import { useConfig as useWagmiConfig } from 'wagmi';
import { TOKENS, useUpgradeHistory } from '@jetstreamgg/sky-hooks';
import {
  TxStatus,
  UpgradeAction,
  UpgradeWidget,
  WidgetStateChangeParams,
  UpgradeFlow,
  UpgradeScreen,
  upgradeTokens
} from '@jetstreamgg/sky-widgets';
import { IntentMapping, QueryParams, REFRESH_DELAY } from '@/lib/constants';
import { SharedProps } from '@/modules/app/types/Widgets';
import { LinkedActionSteps } from '@/modules/config/context/ConfigContext';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { useCustomNavigation } from '@/modules/ui/hooks/useCustomNavigation';
import { updateParamsFromTransaction } from '@/modules/utils/updateParamsFromTransaction';
import { capitalizeFirstLetter } from '@/lib/helpers/string/capitalizeFirstLetter';
import { useSubgraphUrl } from '@/modules/app/hooks/useSubgraphUrl';
import { deleteSearchParams } from '@/modules/utils/deleteSearchParams';
import { useChatContext } from '@/modules/chat/context/ChatContext';
import { useEffect, useState } from 'react';
import { Intent } from '@/lib/enums';
import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';

const targetTokenFromSourceToken = (sourceToken?: string) => {
  if (sourceToken === 'DAI') return 'USDS';
  if (sourceToken === 'MKR') return 'SKY';
  return sourceToken;
};

export function UpgradeWidgetPane(sharedProps: SharedProps) {
  const subgraphUrl = useSubgraphUrl();
  const { linkedActionConfig, updateLinkedActionConfig, exitLinkedActionMode } = useConfigContext();
  const { mutate: refreshUpgradeHistory } = useUpgradeHistory({ subgraphUrl });

  const wagmiConfig = useWagmiConfig();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setShouldDisableActionButtons } = useChatContext();

  const flow = (searchParams.get(QueryParams.Flow) || undefined) as UpgradeFlow | undefined;
  const [currentToken, setCurrentToken] = useState<string | undefined>();

  const { onNavigate, setCustomHref, customNavLabel, setCustomNavLabel } = useCustomNavigation();

  // Get source_token from URL params
  const sourceToken = searchParams.get(QueryParams.SourceToken)?.toUpperCase();

  const [batchEnabled, setBatchEnabled] = useBatchToggle();

  // Set initial currentToken from sourceToken
  useEffect(() => {
    if (sourceToken && !currentToken) {
      setCurrentToken(sourceToken);
    }
  }, []);

  // Update URL when token changes
  useEffect(() => {
    if (currentToken && currentToken !== sourceToken) {
      setSearchParams(prevParams => {
        const params = new URLSearchParams(prevParams);
        params.set(QueryParams.SourceToken, currentToken);
        return params;
      });
    }
  }, [currentToken, sourceToken, setSearchParams]);

  const onUpgradeWidgetStateChange = ({
    hash,
    txStatus,
    widgetState,
    targetToken,
    originToken,
    originAmount
  }: WidgetStateChangeParams) => {
    // Prevent race conditions
    if (searchParams.get(QueryParams.Widget) !== IntentMapping[Intent.UPGRADE_INTENT]) {
      return;
    }

    setShouldDisableActionButtons(txStatus === TxStatus.INITIALIZED);

    // Set flow search param based on widgetState.flow
    if (widgetState.flow) {
      setSearchParams(prev => {
        prev.set(QueryParams.Flow, widgetState.flow);
        return prev;
      });
    }

    if (originToken) {
      setSearchParams(prev => {
        prev.set(QueryParams.SourceToken, originToken);
        return prev;
      });
    } else if (originToken === '') {
      setSearchParams(prev => {
        prev.delete(QueryParams.SourceToken);
        return prev;
      });
    }

    if (originAmount && originAmount !== '0') {
      setSearchParams(prev => {
        prev.set(QueryParams.InputAmount, originAmount);
        return prev;
      });
    } else if (originAmount === '') {
      setSearchParams(prev => {
        prev.delete(QueryParams.InputAmount);
        return prev;
      });
    }

    // Update currentToken if originToken changes and is different from the sourceToken param
    if (originToken && originToken !== currentToken && originToken !== sourceToken) {
      setCurrentToken(originToken);
    }

    if (
      widgetState.action === UpgradeAction.UPGRADE &&
      txStatus === TxStatus.SUCCESS &&
      linkedActionConfig.step === LinkedActionSteps.CURRENT_FUTURE
    ) {
      updateLinkedActionConfig({ step: LinkedActionSteps.SUCCESS_FUTURE });
    }

    if (
      hash &&
      txStatus === TxStatus.SUCCESS &&
      [UpgradeAction.UPGRADE, UpgradeAction.REVERT].includes(widgetState.action)
    ) {
      setTimeout(() => {
        refreshUpgradeHistory();
      }, REFRESH_DELAY);

      //If the action is not "revert" inspect the tx receipt and update the URL accordingly
      if (linkedActionConfig?.linkedAction && widgetState.action !== UpgradeAction.REVERT) {
        updateParamsFromTransaction(hash, wagmiConfig, setSearchParams);
      }
    }
    // When we're ready to proceed with the next LA step, set the href & nav label accordingly
    if (
      txStatus === TxStatus.SUCCESS &&
      widgetState.action === UpgradeAction.UPGRADE &&
      linkedActionConfig?.linkedAction &&
      linkedActionConfig.step === LinkedActionSteps.SUCCESS_FUTURE
    ) {
      setCustomHref(
        `/?${QueryParams.Widget}=${linkedActionConfig.linkedAction}&${QueryParams.InputAmount}=${linkedActionConfig?.inputAmount}&${QueryParams.LinkedAction}=${linkedActionConfig.linkedAction}${linkedActionConfig.rewardContract ? `&${QueryParams.Reward}=${linkedActionConfig.rewardContract}` : ''}`
      );
      setCustomNavLabel(`Go to ${capitalizeFirstLetter(linkedActionConfig.linkedAction)}`);
    } else {
      setCustomHref(undefined);
      setCustomNavLabel(undefined);
    }

    //exit upgrade linked action if we start a revert transaction
    if (
      linkedActionConfig.initialAction === UpgradeAction.UPGRADE &&
      widgetState.flow === UpgradeFlow.REVERT &&
      widgetState.screen === UpgradeScreen.TRANSACTION
    ) {
      setSearchParams(prevParams => {
        const sourceTokenParam = prevParams.get(QueryParams.SourceToken);
        const params = deleteSearchParams(prevParams);
        // Keep the source token param, otherwise the revert flow will break after approving
        if (sourceTokenParam) {
          params.set(QueryParams.SourceToken, sourceTokenParam);
        }
        return params;
      });
      exitLinkedActionMode();
    }

    //exit upgrade linked action if we start a transaction with the wrong source token
    if (
      linkedActionConfig.initialAction === UpgradeAction.UPGRADE &&
      widgetState.flow === UpgradeFlow.UPGRADE &&
      widgetState.screen === UpgradeScreen.TRANSACTION &&
      linkedActionConfig.sourceToken &&
      targetToken &&
      targetToken !== targetTokenFromSourceToken(linkedActionConfig.sourceToken)
    ) {
      setSearchParams(prevParams => {
        const params = deleteSearchParams(prevParams);
        return params;
      });
      exitLinkedActionMode();
    }
  };

  return (
    <UpgradeWidget
      {...sharedProps}
      externalWidgetState={{
        amount: linkedActionConfig?.inputAmount,
        flow,
        initialUpgradeToken: (sourceToken && Object.values(upgradeTokens).includes(sourceToken)
          ? sourceToken
          : linkedActionConfig.sourceToken &&
              Object.values(upgradeTokens).includes(linkedActionConfig.sourceToken.toUpperCase())
            ? (linkedActionConfig.sourceToken.toUpperCase() as keyof typeof upgradeTokens)
            : undefined) as keyof typeof upgradeTokens | undefined
      }}
      onWidgetStateChange={onUpgradeWidgetStateChange}
      customNavigationLabel={customNavLabel}
      onCustomNavigation={onNavigate}
      upgradeOptions={[TOKENS.dai, TOKENS.mkr]}
      batchEnabled={batchEnabled}
      setBatchEnabled={setBatchEnabled}
    />
  );
}
