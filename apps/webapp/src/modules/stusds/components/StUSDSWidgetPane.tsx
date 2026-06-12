import { StUSDSWidget, TxStatus, StUSDSAction, WidgetStateChangeParams, StUSDSFlow } from '@/widgets';
import { useSavingsHistory } from '@/hooks';
import { QueryParams, REFRESH_DELAY } from '@/lib/constants';
import { useNavigate } from '@tanstack/react-router';
import { keepSearch, useAppSearchParams, useRouteExpertIntent } from '@/lib/navigation';
import { useSubgraphUrl } from '@/modules/app/hooks/useSubgraphUrl';
import { ExpertIntent } from '@/lib/enums';

export function StUSDSWidgetPane() {
  const subgraphUrl = useSubgraphUrl();
  const { mutate: refreshSavingsHistory } = useSavingsHistory(subgraphUrl);
  const [searchParams, setSearchParams] = useAppSearchParams();
  const navigate = useNavigate();
  const expertIntent = useRouteExpertIntent();

  const flow = (searchParams.get(QueryParams.Flow) || undefined) as StUSDSFlow | undefined;

  const onStUSDSWidgetStateChange = ({
    hash,
    txStatus,
    widgetState,
    originToken
  }: WidgetStateChangeParams) => {
    // Prevent race conditions
    if (expertIntent !== ExpertIntent.STUSDS_INTENT) {
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
    void navigate({ to: '/earn/expert', search: keepSearch });
  };

  return (
    <StUSDSWidget
      onWidgetStateChange={onStUSDSWidgetStateChange}
      externalWidgetState={{ flow }}
      onBackToExpert={handleBack}
    />
  );
}
