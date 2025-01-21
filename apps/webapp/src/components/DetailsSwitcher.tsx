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
import { t } from '@lingui/macro';
import { BP, useBreakpointIndex } from '@/modules/ui/hooks/useBreakpointIndex';

export function DetailsSwitcher(): JSX.Element {
  const chatEnabled = import.meta.env.VITE_CHATBOT_ENABLED === 'true';
  const { bpi } = useBreakpointIndex();
  const [searchParams, setSearchParams] = useSearchParams();
  const detailsParam = !(searchParams.get(QueryParams.Details) === 'false');
  const handleSwitch = (pressed: boolean) => {
    const queryParam = pressed ? 'true' : 'false';
    searchParams.set(QueryParams.Details, queryParam);
    if ([BP.md, BP.lg].includes(bpi) && queryParam) searchParams.set(QueryParams.Chat, 'false');
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
            className={`hidden h-10 w-10 rounded-xl md:flex ${chatEnabled ? 'md:rounded-r-none' : ''} `}
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
