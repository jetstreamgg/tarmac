import {
  SavingsWidget,
  BaseSavingsWidget,
  TxStatus,
  SavingsAction,
  WidgetStateChangeParams,
  SavingsFlow
} from '@jetstreamgg/widgets';
import { TOKENS, useSavingsHistory } from '@jetstreamgg/hooks';
import { isBaseChainId } from '@jetstreamgg/utils';
import { QueryParams, REFRESH_DELAY } from '@/lib/constants';
import { SharedProps } from '@/modules/app/types/Widgets';
import { LinkedActionSteps } from '@/modules/config/context/ConfigContext';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { useSearchParams } from 'react-router-dom';
import { deleteSearchParams } from '@/modules/utils/deleteSearchParams';
import { useSubgraphUrl } from '@/modules/app/hooks/useSubgraphUrl';
import { useChainId } from 'wagmi';

export function SavingsWidgetPane(sharedProps: SharedProps) {
  const subgraphUrl = useSubgraphUrl();
  const { linkedActionConfig, updateLinkedActionConfig, exitLinkedActionMode } = useConfigContext();
  const { mutate: refreshSavingsHistory } = useSavingsHistory(subgraphUrl);
  const [searchParams, setSearchParams] = useSearchParams();
  const chainId = useChainId();

  const isBaseChain = isBaseChainId(chainId);
  const isRestrictedMiCa = import.meta.env.VITE_RESTRICTED_BUILD_MICA === 'true';
  const disallowedTokens =
    isRestrictedMiCa && isBaseChain ? { supply: [TOKENS.usdc], withdraw: [TOKENS.usdc] } : undefined;
  const tab = (searchParams.get(QueryParams.Tab) || undefined) as 'left' | 'right' | undefined;

  const onSavingsWidgetStateChange = ({
    hash,
    txStatus,
    widgetState,
    originToken,
    originAmount
  }: WidgetStateChangeParams) => {
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

    // Set tab search param based on widgetState.flow
    if (widgetState.flow) {
      setSearchParams(prev => {
        prev.set(QueryParams.Tab, widgetState.flow === SavingsFlow.SUPPLY ? 'left' : 'right');
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

  const Widget = isBaseChain ? BaseSavingsWidget : SavingsWidget;

  return (
    <Widget
      {...sharedProps}
      onWidgetStateChange={onSavingsWidgetStateChange}
      externalWidgetState={{
        amount: linkedActionConfig?.inputAmount,
        token: isBaseChain ? linkedActionConfig?.sourceToken : undefined,
        tab
      }}
      disallowedTokens={disallowedTokens}
    />
  );
}
