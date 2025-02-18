import {
  WidgetStateChangeParams,
  SavingsFlow,
  BalancesWidget,
  BalancesWidgetProps
} from '@jetstreamgg/widgets';
import { useSearchParams } from 'react-router-dom';
import { SharedProps } from '@/modules/app/types/Widgets';
import { QueryParams } from '@/lib/constants';

export function BalancesWidgetPane(sharedProps: SharedProps & BalancesWidgetProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  const flow = (searchParams.get(QueryParams.Flow) || undefined) as SavingsFlow | undefined;

  const onBalancesWidgetStateChange = ({ widgetState }: WidgetStateChangeParams) => {
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
