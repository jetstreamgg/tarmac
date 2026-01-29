import { useSearchParams } from 'react-router-dom';
import { useBreakpointIndex, BP } from '@/modules/ui/hooks/useBreakpointIndex';
import { QueryParams } from '@/lib/constants';

export const FLOATING_CHAT_BP = BP['3xl'];

/**
 * Hook to determine if floating chat should be shown
 * Floating chat is shown by default on wide screens (3xl+) unless chat param is "false"
 * On smaller screens, chat is opt-in and requires chat param to be "true"
 */
export const useFloatingChat = () => {
  const { bpi } = useBreakpointIndex();
  const [searchParams] = useSearchParams();
  const chatParam = searchParams.get(QueryParams.Chat);

  const supportsFloatingChat = bpi >= FLOATING_CHAT_BP;

  // For floating chat: show by default unless explicitly set to "false"
  // For smaller screens: opt-in behavior (must be "true")
  const isChatOpen = supportsFloatingChat
    ? chatParam !== 'false' // Default open on wide screens
    : chatParam === 'true'; // Opt-in on smaller screens

  const shouldShowFloating = supportsFloatingChat && isChatOpen;

  return {
    shouldShowFloating,
    supportsFloatingChat,
    isChatOpen
  };
};
