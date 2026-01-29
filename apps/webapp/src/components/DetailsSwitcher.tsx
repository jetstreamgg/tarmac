import { Toggle } from '@/components/ui/toggle';
import { Metrics } from '@/modules/icons';
import { useMatch, useSearchParams } from 'react-router-dom';
import { CHATBOT_ENABLED, QueryParams } from '@/lib/constants';
import { Text } from '@/modules/layout/components/Typography';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipArrow,
  TooltipPortal
} from '@/components/ui/tooltip';
import { t } from '@lingui/core/macro';
import { BP, useBreakpointIndex } from '@/modules/ui/hooks/useBreakpointIndex';
import { JSX } from 'react';
import { useFloatingChat } from '@/modules/chat/hooks/useFloatingChat';

export function DetailsSwitcher(): JSX.Element {
  const isSealEngine = useMatch('/seal-engine');
  const { bpi } = useBreakpointIndex();
  const [searchParams, setSearchParams] = useSearchParams();
  const { supportsFloatingChat } = useFloatingChat();
  const detailsParam = !(searchParams.get(QueryParams.Details) === 'false');
  const handleSwitch = (pressed: boolean) => {
    const queryParam = pressed ? 'true' : 'false';
    searchParams.set(QueryParams.Details, queryParam);
    if ([BP.md, BP.lg, BP.xl, BP['2xl']].includes(bpi) && queryParam)
      searchParams.set(QueryParams.Chat, 'false');
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
            className={`hidden h-10 w-10 rounded-xl md:flex ${CHATBOT_ENABLED && !supportsFloatingChat && !isSealEngine ? 'md:rounded-r-none' : ''} `}
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
