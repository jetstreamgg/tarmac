import { Toggle } from '@/components/ui/toggle';
import { Metrics } from '@/modules/icons';
import { useSearchParams } from 'react-router-dom';
import { QueryParams } from '@/lib/constants';
import { Text } from '@/modules/layout/components/Typography';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipArrow,
  TooltipPortal
} from '@/components/ui/tooltip';
import { t } from '@lingui/core/macro';
import { useAppAnalytics } from '@/modules/analytics/hooks/useAppAnalytics';
import { JSX } from 'react';

export function DetailsSwitcher(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const { trackDetailsPaneToggled } = useAppAnalytics();
  const detailsParam = !(searchParams.get(QueryParams.Details) === 'false');
  const handleSwitch = (pressed: boolean) => {
    trackDetailsPaneToggled({
      toggleAction: pressed ? 'open' : 'close',
      activeWidget: searchParams.get(QueryParams.Widget) || 'balances'
    });
    const queryParam = pressed ? 'true' : 'false';
    searchParams.set(QueryParams.Details, queryParam);
    setSearchParams(searchParams);
  };

  // Note: onPressedChange callback fires when the toggle is clicked
  // https://www.radix-ui.com/primitives/docs/components/toggle
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>
          <Toggle
            variant="singleSwitcher"
            className="hidden h-10 w-10 rounded-xl md:flex"
            pressed={detailsParam}
            onPressedChange={handleSwitch}
            aria-label="Toggle details"
          >
            <Metrics width={17} height={17} />
          </Toggle>
        </div>
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent arrowPadding={10}>
          <Text variant="small">{detailsParam ? t`Hide details` : t`View details`}</Text>
          <TooltipArrow width={12} height={8} />
        </TooltipContent>
      </TooltipPortal>
    </Tooltip>
  );
}
