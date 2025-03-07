import {
  WidgetStateChangeParams,
  SavingsFlow,
  BalancesWidget,
  BalancesWidgetProps,
  TxStatus
} from '@jetstreamgg/widgets';
import { useSearchParams } from 'react-router-dom';
import { SharedProps } from '@/modules/app/types/Widgets';
import { QueryParams } from '@/lib/constants';
import { useChatContext } from '@/modules/chat/context/ChatContext';

export function BalancesWidgetPane(sharedProps: SharedProps & BalancesWidgetProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { setShouldDisableActionButtons } = useChatContext();

  const flow = (searchParams.get(QueryParams.Flow) || undefined) as SavingsFlow | undefined;

  const onBalancesWidgetStateChange = ({ widgetState, txStatus }: WidgetStateChangeParams) => {
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
