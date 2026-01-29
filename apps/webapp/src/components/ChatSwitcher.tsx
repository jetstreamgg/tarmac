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
import { useFloatingChat } from '@/modules/chat/hooks/useFloatingChat';
import { JSX } from 'react';

export function ChatSwitcher(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isChatOpen, supportsFloatingChat } = useFloatingChat();

  const handleSwitch = (pressed: boolean) => {
    const queryParam = pressed ? 'true' : 'false';
    searchParams.set(QueryParams.Chat, queryParam);
    // On mobile (< 3xl), hide details when chat is shown
    if (!supportsFloatingChat && pressed) {
      searchParams.set(QueryParams.Details, 'false');
    }
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
            pressed={isChatOpen}
            onPressedChange={handleSwitch}
            aria-label="Toggle chat"
          >
            <Chat width={20} height={20} />
          </Toggle>
        </div>
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent arrowPadding={10}>
          <Text variant="small">{isChatOpen ? t`Hide chat` : t`View chat`}</Text>
          <TooltipArrow width={12} height={8} />
        </TooltipContent>
      </TooltipPortal>
    </Tooltip>
  );
}
