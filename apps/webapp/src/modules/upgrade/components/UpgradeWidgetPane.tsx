import { useSearchParams } from 'react-router-dom';

import { useConfig as useWagmiConfig, useChainId } from 'wagmi';
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
import { ConvertIntentMapping, IntentMapping, QueryParams, REFRESH_DELAY } from '@/lib/constants';
import { SharedProps } from '@/modules/app/types/Widgets';
import { LinkedActionSteps } from '@/modules/config/context/ConfigContext';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { useCustomNavigation } from '@/modules/ui/hooks/useCustomNavigation';
import { updateParamsFromTransaction } from '@/modules/utils/updateParamsFromTransaction';
import { capitalizeFirstLetter } from '@/lib/helpers/string/capitalizeFirstLetter';
import { useSubgraphUrl } from '@/modules/app/hooks/useSubgraphUrl';
import { deleteSearchParams } from '@/modules/utils/deleteSearchParams';
import { useEffect, useState } from 'react';
import { ConvertIntent, Intent } from '@/lib/enums';
import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';
import { useWidgetAnalytics } from '@/modules/analytics/hooks/useWidgetAnalytics';

const targetTokenFromSourceToken = (sourceToken?: string) => {
  if (sourceToken === 'DAI') return 'USDS';
  if (sourceToken === 'MKR') return 'SKY';
  return sourceToken;
};

export function UpgradeWidgetPane(sharedProps: SharedProps) {
  const chainId = useChainId();
  const subgraphUrl = useSubgraphUrl();
  const { linkedActionConfig, updateLinkedActionConfig, exitLinkedActionMode, setSelectedConvertOption } =
    useConfigContext();
  const { mutate: refreshUpgradeHistory } = useUpgradeHistory({ subgraphUrl });

  const wagmiConfig = useWagmiConfig();
  const [searchParams, setSearchParams] = useSearchParams();

  const flow = (searchParams.get(QueryParams.Flow) || undefined) as UpgradeFlow | undefined;
  const [currentToken, setCurrentToken] = useState<string | undefined>();

  const { onNavigate, setCustomHref, customNavLabel, setCustomNavLabel } = useCustomNavigation();

  // Get source_token from URL params
  const sourceToken = searchParams.get(QueryParams.SourceToken)?.toUpperCase();

  const [batchEnabled, setBatchEnabled] = useBatchToggle();
  const onAnalyticsEvent = useWidgetAnalytics('convert', chainId);

  const widgetParam = searchParams.get(QueryParams.Widget)?.toLowerCase();
  const isConvertContext = widgetParam === IntentMapping[Intent.CONVERT_INTENT];

  const handleBackToConvert = () => {
    setSearchParams(params => {
      params.delete(QueryParams.ConvertModule);
      return params;
    });
    setSelectedConvertOption(undefined);
  };

  // Set initial currentToken from sourceToken
  useEffect(() => {
    if (sourceToken && !currentToken) {
      setCurrentToken(sourceToken);
    }
  }, []);

  // Update URL when token changes
  useEffect(() => {
    if (currentToken && currentToken !== sourceToken) {
      setSearchParams(
        prevParams => {
          const params = new URLSearchParams(prevParams);
          params.set(QueryParams.SourceToken, currentToken);
          return params;
        },
        { replace: true }
      );
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
    const widgetParam = searchParams.get(QueryParams.Widget)?.toLowerCase();
    const convertModuleParam = searchParams.get(QueryParams.ConvertModule)?.toLowerCase();
    const isUpgradeContext =
      widgetParam === IntentMapping[Intent.UPGRADE_INTENT] ||
      (widgetParam === IntentMapping[Intent.CONVERT_INTENT] &&
        convertModuleParam === ConvertIntentMapping[ConvertIntent.UPGRADE_INTENT]);

    if (!isUpgradeContext) {
      return;
    }

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
      const rewardParam = linkedActionConfig.rewardContract
        ? `&${QueryParams.Reward}=${linkedActionConfig.rewardContract}`
        : '';
      const moduleParam = linkedActionConfig.expertModule
        ? linkedActionConfig.linkedAction === IntentMapping[Intent.VAULTS_INTENT]
          ? `&${QueryParams.VaultModule}=${linkedActionConfig.expertModule}`
          : `&${QueryParams.ExpertModule}=${linkedActionConfig.expertModule}`
        : '';

      setCustomHref(
        `/?${QueryParams.Widget}=${linkedActionConfig.linkedAction}&${QueryParams.InputAmount}=${linkedActionConfig?.inputAmount}&${QueryParams.LinkedAction}=${linkedActionConfig.linkedAction}${rewardParam}${moduleParam}`
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
      setSearchParams(
        prevParams => {
          const sourceTokenParam = prevParams.get(QueryParams.SourceToken);
          const params = deleteSearchParams(prevParams);
          // Keep the source token param, otherwise the revert flow will break after approving
          if (sourceTokenParam) {
            params.set(QueryParams.SourceToken, sourceTokenParam);
          }
          return params;
        },
        { replace: true }
      );
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
      setSearchParams(
        prevParams => {
          const params = deleteSearchParams(prevParams);
          return params;
        },
        { replace: true }
      );
      exitLinkedActionMode();
    }
  };

  const disallowedFlow =
    linkedActionConfig.showLinkedAction && linkedActionConfig.sourceToken
      ? UpgradeFlow.REVERT // If in linked action, disallow revert
      : undefined;

  const linkedSourceSymbol =
    linkedActionConfig.showLinkedAction && linkedActionConfig.sourceToken
      ? linkedActionConfig.sourceToken.toLowerCase()
      : undefined;
  const linkedSourceToken = linkedSourceSymbol ? TOKENS[linkedSourceSymbol] : undefined;
  const upgradeOptions = linkedSourceToken ? [linkedSourceToken] : [TOKENS.dai, TOKENS.mkr];

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
      onAnalyticsEvent={onAnalyticsEvent}
      customNavigationLabel={customNavLabel}
      onCustomNavigation={onNavigate}
      upgradeOptions={upgradeOptions}
      disallowedFlow={disallowedFlow}
      batchEnabled={batchEnabled}
      setBatchEnabled={setBatchEnabled}
      onBackToConvert={isConvertContext ? handleBackToConvert : undefined}
    />
  );
}
