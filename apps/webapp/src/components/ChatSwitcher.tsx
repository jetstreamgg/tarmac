import { Toggle } from '@/components/ui/toggle';
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
import { Chat } from '@/modules/icons';
import { BP, useBreakpointIndex } from '@/modules/ui/hooks/useBreakpointIndex';
import { useAppAnalytics } from '@/modules/analytics/hooks/useAppAnalytics';
import { useChatAnalytics } from '@/modules/chat/hooks/useChatAnalytics';
import { JSX, useEffect } from 'react';

// Module-level flag so the impression fires exactly once per page load,
// regardless of React Strict Mode or parent remounts.
let entryImpressionTracked = false;

export function ChatSwitcher(): JSX.Element {
  const { bpi } = useBreakpointIndex();
  const [searchParams, setSearchParams] = useSearchParams();
  const showingChat =
    bpi >= BP['3xl']
      ? !(searchParams.get(QueryParams.Chat) === 'false')
      : searchParams.get(QueryParams.Chat) === 'true';

  const { trackChatPaneToggled } = useAppAnalytics();
  const { trackEntryImpression } = useChatAnalytics();

  // Only track the impression when chat is not already open,
  // since on large viewports chat is open by default and the
  // toggle is not the entry point.
  useEffect(() => {
    if (!entryImpressionTracked && !showingChat) {
      entryImpressionTracked = true;
      trackEntryImpression({ entry_type: 'toggle_button' });
    }
  }, [trackEntryImpression, showingChat]);

  const handleSwitch = (pressed: boolean) => {
    trackChatPaneToggled({
      toggleAction: pressed ? 'open' : 'close',
      activeWidget: searchParams.get(QueryParams.Widget) || 'balances',
      detailsWasOpen: !(searchParams.get(QueryParams.Details) === 'false')
    });
    const queryParam = pressed ? 'true' : 'false';
    searchParams.set(QueryParams.Chat, queryParam);
    if (bpi < BP['3xl'] && queryParam) searchParams.set(QueryParams.Details, 'false');
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
            className="h-10 w-10 rounded-xl pt-[9px] pr-[14px] pb-2 pl-4 md:rounded-l-none"
            pressed={showingChat}
            onPressedChange={handleSwitch}
            aria-label="Toggle chat"
          >
            <Chat width={20} height={20} />
          </Toggle>
        </div>
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent arrowPadding={10}>
          <Text variant="small">{showingChat ? t`Hide chat` : t`View chat`}</Text>
          <TooltipArrow width={12} height={8} />
        </TooltipContent>
      </TooltipPortal>
    </Tooltip>
  );
}
