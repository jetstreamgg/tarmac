import {
  SavingsWidget,
  L2SavingsWidget,
  TxStatus,
  SavingsAction,
  WidgetStateChangeParams,
  SavingsFlow
} from '@/widgets';
import { useSavingsHistory } from '@/hooks';
import { IntentMapping, QueryParams, REFRESH_DELAY } from '@/lib/constants';
import { isL2ChainId } from '@/utils';
import { SharedProps } from '@/modules/app/types/Widgets';
import { useSearchParams } from 'react-router-dom';
import { useSubgraphUrl } from '@/modules/app/hooks/useSubgraphUrl';
import { useChainId } from 'wagmi';
import { Intent } from '@/lib/enums';

export function SavingsWidgetPane(sharedProps: SharedProps) {
  const subgraphUrl = useSubgraphUrl();
  const { mutate: refreshSavingsHistory } = useSavingsHistory(subgraphUrl);
  const [searchParams, setSearchParams] = useSearchParams();
  const chainId = useChainId();

  const isL2 = isL2ChainId(chainId);
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

    // Update amount in URL if provided and not zero
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

  return (
    <Widget
      {...sharedProps}
      onWidgetStateChange={onSavingsWidgetStateChange}
      externalWidgetState={{ flow }}
    />
  );
}
