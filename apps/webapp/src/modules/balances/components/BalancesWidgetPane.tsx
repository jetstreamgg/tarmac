import { WidgetStateChangeParams, SavingsFlow, BalancesWidget, BalancesWidgetProps } from '@/widgets';
import { useNavigate } from '@tanstack/react-router';
import { retainOnNavigate, useAppSearchParams, useRouteIntent } from '@/lib/navigation';
import { useCallback } from 'react';
import { QueryParams } from '@/lib/constants';
import { Intent } from '@/lib/enums';

export function BalancesWidgetPane(widgetProps: BalancesWidgetProps) {
  const [searchParams, setSearchParams] = useAppSearchParams();
  const navigate = useNavigate();
  const intent = useRouteIntent();

  const flow = (searchParams.get(QueryParams.Flow) || undefined) as SavingsFlow | undefined;

  const onExploreVaults = useCallback(() => {
    void navigate({ to: '/earn', search: retainOnNavigate });
  }, [navigate]);

  const onBalancesWidgetStateChange = ({ widgetState }: WidgetStateChangeParams) => {
    // Prevent race conditions
    if (intent !== Intent.BALANCES_INTENT) {
      return;
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
  };

  return (
    <BalancesWidget
      {...widgetProps}
      externalWidgetState={{
        flow
      }}
      onWidgetStateChange={onBalancesWidgetStateChange}
      onExploreVaults={onExploreVaults}
      hideWalletCard
    />
  );
}
