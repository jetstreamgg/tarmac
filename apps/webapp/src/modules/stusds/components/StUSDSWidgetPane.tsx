import { StUSDSWidget, TxStatus, StUSDSAction, WidgetStateChangeParams, StUSDSFlow } from '@/widgets';
import { useSavingsHistory } from '@/hooks';
import { ExpertIntentMapping, QueryParams, REFRESH_DELAY } from '@/lib/constants';
import { SharedProps } from '@/modules/app/types/Widgets';
import { useConfigContext } from '@/modules/config/hooks/useConfigContext';
import { useAppSearchParams } from '@/lib/router';
import { useSubgraphUrl } from '@/modules/app/hooks/useSubgraphUrl';
import { ExpertIntent } from '@/lib/enums';

export function StUSDSWidgetPane(sharedProps: SharedProps) {
  const subgraphUrl = useSubgraphUrl();
  const { setSelectedExpertOption } = useConfigContext();
  const { mutate: refreshSavingsHistory } = useSavingsHistory(subgraphUrl);
  const [searchParams, setSearchParams] = useAppSearchParams();

  const flow = (searchParams.get(QueryParams.Flow) || undefined) as StUSDSFlow | undefined;

  const onStUSDSWidgetStateChange = ({
    hash,
    txStatus,
    widgetState,
    originToken
  }: WidgetStateChangeParams) => {
    // Prevent race conditions
    if (searchParams.get(QueryParams.ExpertModule) !== ExpertIntentMapping[ExpertIntent.STUSDS_INTENT]) {
      return;
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
      externalWidgetState={{ flow }}
      onBackToExpert={handleBack}
    />
  );
}
