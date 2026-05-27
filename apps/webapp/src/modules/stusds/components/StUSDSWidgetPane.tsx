import { StUSDSWidget, TxStatus, StUSDSAction, WidgetStateChangeParams, StUSDSFlow } from '@/widgets';
import { useSavingsHistory } from '@/hooks';
import { ExpertIntentMapping, QueryParams, REFRESH_DELAY } from '@/lib/constants';
import { SharedProps } from '@/modules/app/types/Widgets';
import { LinkedActionSteps } from '@/modules/config/context/ConfigContext';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { useSearchParams } from 'react-router-dom';
import { deleteSearchParams } from '@/modules/utils/deleteSearchParams';
import { useSubgraphUrl } from '@/modules/app/hooks/useSubgraphUrl';
import { ExpertIntent } from '@/lib/enums';

export function StUSDSWidgetPane(sharedProps: SharedProps) {
  const subgraphUrl = useSubgraphUrl();
  const { linkedActionConfig, updateLinkedActionConfig, exitLinkedActionMode, setSelectedExpertOption } =
    useConfigContext();
  const { mutate: refreshSavingsHistory } = useSavingsHistory(subgraphUrl);
  const [searchParams, setSearchParams] = useSearchParams();

  const flow = (searchParams.get(QueryParams.Flow) || undefined) as StUSDSFlow | undefined;

  const onStUSDSWidgetStateChange = ({
    hash,
    txStatus,
    widgetState,
    originToken,
    originAmount
  }: WidgetStateChangeParams) => {
    // Prevent race conditions
    if (searchParams.get(QueryParams.ExpertModule) !== ExpertIntentMapping[ExpertIntent.STUSDS_INTENT]) {
      return;
    }

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
    const { flow } = widgetState;
    if (flow) {
      setSearchParams(prev => {
        prev.set(QueryParams.Flow, flow);
        return prev;
      });
    }

    // After a successful linked action SUPPLY, set the final step to "success"
    if (
      widgetState.action === StUSDSAction.SUPPLY &&
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
      [StUSDSAction.SUPPLY, StUSDSAction.WITHDRAW].includes(widgetState.action as StUSDSAction)
    ) {
      setTimeout(() => {
        refreshSavingsHistory();
      }, REFRESH_DELAY);
    }
  };

  const handleBack = () => {
    setSearchParams(params => {
      params.delete(QueryParams.ExpertModule);
      return params;
    });
    setSelectedExpertOption(undefined);
  };

  return (
    <StUSDSWidget
      {...sharedProps}
      onWidgetStateChange={onStUSDSWidgetStateChange}
      externalWidgetState={{
        amount: linkedActionConfig?.inputAmount,
        flow
      }}
      onBackToExpert={handleBack}
    />
  );
}
