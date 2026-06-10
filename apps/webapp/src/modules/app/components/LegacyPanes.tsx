import { useRouteIntent } from '@/lib/navigation';
import { useBreakpointIndex } from '@/modules/ui/hooks/useBreakpointIndex';
import { useWidgetItems } from '../hooks/useWidgetItems';
import { DetailsPane } from './DetailsPane';
import { TwoPane } from './TwoPane';

/**
 * Transitional route component shared by every module route: looks up the
 * module's widget pane in the legacy widget-items switch and pairs it with
 * the legacy DetailsPane switch. Modules migrate off this onto their own
 * explicit widget/details pairs one at a time.
 */
export function LegacyPanes() {
  const intent = useRouteIntent();
  const { bpi } = useBreakpointIndex();
  const { widgetItems, effectiveIntent } = useWidgetItems(intent);

  const widget = widgetItems.find(([itemIntent]) => itemIntent === effectiveIntent)?.[3] ?? null;

  return (
    <TwoPane
      // Remount per module (matching the old per-intent TabsContent) and per
      // breakpoint (matching the old widget-pane key in MainApp).
      key={`${effectiveIntent}-${bpi}`}
      widget={widget}
      details={<DetailsPane intent={intent} />}
    />
  );
}
