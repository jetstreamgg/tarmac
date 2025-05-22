import {
  SavingsWidget,
  L2SavingsWidget,
  TxStatus,
  SavingsAction,
  WidgetStateChangeParams,
  SavingsFlow
} from '@jetstreamgg/widgets';
import { TOKENS, useSavingsHistory } from '@jetstreamgg/hooks';
import { IntentMapping, QueryParams, REFRESH_DELAY } from '@/lib/constants';
import { isL2ChainId } from '@jetstreamgg/utils';
import { SharedProps } from '@/modules/app/types/Widgets';
import { LinkedActionSteps } from '@/modules/config/context/ConfigContext';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { useSearchParams } from 'react-router-dom';
import { deleteSearchParams } from '@/modules/utils/deleteSearchParams';
import { useSubgraphUrl } from '@/modules/app/hooks/useSubgraphUrl';
import { useChainId } from 'wagmi';
import { useChatContext } from '@/modules/chat/context/ChatContext';
import { Intent } from '@/lib/enums';

export function SavingsWidgetPane(sharedProps: SharedProps) {
  const subgraphUrl = useSubgraphUrl();
  const { linkedActionConfig, updateLinkedActionConfig, exitLinkedActionMode } = useConfigContext();
  const { mutate: refreshSavingsHistory } = useSavingsHistory(subgraphUrl);
  const [searchParams, setSearchParams] = useSearchParams();
  const chainId = useChainId();
  const { setShouldDisableActionButtons } = useChatContext();

  const isL2 = isL2ChainId(chainId);
  const isRestrictedMiCa = import.meta.env.VITE_RESTRICTED_BUILD_MICA === 'true';

  const disallowedTokens =
    isRestrictedMiCa && isL2 ? { supply: [TOKENS.usdc], withdraw: [TOKENS.usdc] } : undefined;

  const flow = (searchParams.get(QueryParams.Flow) || undefined) as SavingsFlow | undefined;

  const onSavingsWidgetStateChange = ({
    hash,
    txStatus,
    widgetState,
    originToken,
    originAmount
  }: WidgetStateChangeParams) => {
    // Prevent race conditions
    if (searchParams.get(QueryParams.Widget) !== IntentMapping[Intent.SAVINGS_INTENT]) {
      return;
    }

    setShouldDisableActionButtons(txStatus === TxStatus.INITIALIZED);

    // Update amount in URL if provided and not zero
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

    // Update source token in URL if provided
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

    // Set flow search param based on widgetState.flow
    if (widgetState.flow) {
      setSearchParams(prev => {
        prev.set(QueryParams.Flow, widgetState.flow);
        return prev;
      });
    }

    // After a successful linked action SUPPLY, set the final step to "success"
    if (
      widgetState.action === SavingsAction.SUPPLY &&
      txStatus === TxStatus.SUCCESS &&
      linkedActionConfig.step === LinkedActionSteps.COMPLETED_CURRENT
    ) {
      updateLinkedActionConfig({ step: LinkedActionSteps.COMPLETED_SUCCESS });
    }

    // Reset the linked action state and URL params after clicking "finish"
    if (txStatus === TxStatus.IDLE && linkedActionConfig.step === LinkedActionSteps.COMPLETED_SUCCESS) {
      exitLinkedActionMode();
      setSearchParams(prevParams => {
        const params = deleteSearchParams(prevParams);
        return params;
      });
    }

    if (
      hash &&
      txStatus === TxStatus.SUCCESS &&
      [SavingsAction.SUPPLY, SavingsAction.WITHDRAW].includes(widgetState.action)
    ) {
      setTimeout(() => {
        refreshSavingsHistory();
      }, REFRESH_DELAY);
    }
  };

  const Widget = isL2 ? L2SavingsWidget : SavingsWidget;

  return (
    <Widget
      {...sharedProps}
      onWidgetStateChange={onSavingsWidgetStateChange}
      externalWidgetState={{
        amount: linkedActionConfig?.inputAmount,
        token: isL2 ? linkedActionConfig?.sourceToken : undefined,
        flow
      }}
      disallowedTokens={disallowedTokens}
    />
  );
}
