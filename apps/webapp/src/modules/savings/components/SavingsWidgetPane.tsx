import {
  SavingsWidget,
  L2SavingsWidget,
  TxStatus,
  SavingsAction,
  WidgetStateChangeParams,
  SavingsFlow
} from '@/widgets';
import { useSavingsHistory } from '@/hooks';
import { QueryParams, REFRESH_DELAY } from '@/lib/constants';
import { isL2ChainId } from '@/utils';
import { useAppSearchParams, useRouteIntent } from '@/lib/navigation';
import { useSubgraphUrl } from '@/modules/app/hooks/useSubgraphUrl';
import { useChainId } from 'wagmi';
import { Intent } from '@/lib/enums';

export function SavingsWidgetPane() {
  const subgraphUrl = useSubgraphUrl();
  const { mutate: refreshSavingsHistory } = useSavingsHistory(subgraphUrl);
  const [searchParams, setSearchParams] = useAppSearchParams();
  const intent = useRouteIntent();
  const chainId = useChainId();

  const isL2 = isL2ChainId(chainId);
  const flow = (searchParams.get(QueryParams.Flow) || undefined) as SavingsFlow | undefined;

  const onSavingsWidgetStateChange = ({
    hash,
    txStatus,
    widgetState,
    originToken
  }: WidgetStateChangeParams) => {
    // Prevent race conditions
    if (intent !== Intent.SAVINGS_INTENT) {
      return;
    }

    // Update source token in URL if provided
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

    // Set flow search param based on widgetState.flow
    const { flow } = widgetState;
    if (flow) {
      setSearchParams(
        prev => {
          prev.set(QueryParams.Flow, flow);
          return prev;
        },
        { replace: true }
      );
    }

    if (
      hash &&
      txStatus === TxStatus.SUCCESS &&
      [SavingsAction.SUPPLY, SavingsAction.WITHDRAW].includes(widgetState.action as SavingsAction)
    ) {
      setTimeout(() => {
        refreshSavingsHistory();
      }, REFRESH_DELAY);
    }
  };

  const Widget = isL2 ? L2SavingsWidget : SavingsWidget;

  return <Widget onWidgetStateChange={onSavingsWidgetStateChange} externalWidgetState={{ flow }} />;
}
