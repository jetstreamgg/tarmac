import { ConvertIntent, Intent } from '@/lib/enums';
import { DualSwitcher } from '@/components/DualSwitcher';
import { withErrorBoundary } from '@/modules/utils/withErrorBoundary';
import { TwoPane } from '@/modules/app/components/TwoPane';
import { DetailsLayout } from '@/modules/app/components/DetailsLayout';
import { useBreakpointIndex } from '@/modules/ui/hooks/useBreakpointIndex';
import { useRouteConvertIntent } from '@/lib/navigation';
import { ConvertWidgetPane } from './ConvertWidgetPane';
import { ConvertOverviewDetails } from './ConvertOverviewDetails';
import { PsmConversionDetails } from './PsmConversionDetails';
import { TradeDetails } from '@/modules/trade/components/TradeDetails';
import { UpgradeDetails } from '@/modules/upgrade/components/UpgradeDetails';

const detailsForConvertIntent = (convertIntent: ConvertIntent | undefined) => {
  switch (convertIntent) {
    case ConvertIntent.PSM_INTENT:
      return <PsmConversionDetails />;
    case ConvertIntent.UPGRADE_INTENT:
      return <UpgradeDetails />;
    case ConvertIntent.TRADE_INTENT:
      return <TradeDetails />;
    default:
      return <ConvertOverviewDetails />;
  }
};

/** Panes for the Convert module, including the psm/trade/upgrade submodule routes. */
export function ConvertPanes() {
  const { bpi } = useBreakpointIndex();
  const convertIntent = useRouteConvertIntent();

  return (
    <TwoPane
      // Remount per breakpoint, matching the legacy widget-pane key
      key={`convert-${bpi}`}
      widget={withErrorBoundary(
        <ConvertWidgetPane rightHeaderComponent={<DualSwitcher className="hidden lg:flex" />} />
      )}
      details={
        <DetailsLayout
          intent={Intent.CONVERT_INTENT}
          convertOption={convertIntent}
          contentKey={convertIntent ?? 'overview'}
        >
          {detailsForConvertIntent(convertIntent)}
        </DetailsLayout>
      }
    />
  );
}
