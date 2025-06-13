import {
  WidgetStateChangeParams,
  SavingsFlow,
  BalancesWidget,
  BalancesWidgetProps,
  TxStatus
} from '@jetstreamgg/sky-widgets';
import { useSearchParams } from 'react-router-dom';
import { SharedProps } from '@/modules/app/types/Widgets';
import { IntentMapping, QueryParams } from '@/lib/constants';
import { useChatContext } from '@/modules/chat/context/ChatContext';
import { Intent } from '@/lib/enums';

export function BalancesWidgetPane(sharedProps: SharedProps & BalancesWidgetProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { setShouldDisableActionButtons } = useChatContext();

  const flow = (searchParams.get(QueryParams.Flow) || undefined) as SavingsFlow | undefined;

  const onBalancesWidgetStateChange = ({ widgetState, txStatus }: WidgetStateChangeParams) => {
    // Prevent race conditions
    if (searchParams.get(QueryParams.Widget) !== IntentMapping[Intent.BALANCES_INTENT]) {
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
  };

  return (
    <BalancesWidget
      {...sharedProps}
      externalWidgetState={{
        flow
      }}
      onWidgetStateChange={onBalancesWidgetStateChange}
    />
  );
}
