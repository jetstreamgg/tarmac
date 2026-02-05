import { useSearchParams } from 'react-router-dom';
import { useBreakpointIndex, BP } from '@/modules/ui/hooks/useBreakpointIndex';
import { CHATBOT_ENABLED, QueryParams } from '@/lib/constants';

// Breakpoint at which floating chat panel + button is supported (tablet and above)
export const FLOATING_CHAT_BP = BP.md;

// Minimum width (in pixels) at which chat opens by default
export const CHAT_DEFAULT_OPEN_WIDTH = 2550;

/**
 * Hook to determine if floating chat should be shown
 *
 * Floating chat support:
 * - Mobile (sm): Inline chat only, no floating panel
 * - Tablet and above (md+): Floating panel + button available
 *
 * Open by default behavior:
 * - Extra-wide (≥2550px): Chat opens by default unless chat param is "false"
 * - Below 2550px: Chat is closed by default, requires chat param to be "true"
 */
export const useFloatingChat = () => {
  const { bpi, width } = useBreakpointIndex();
  const [searchParams] = useSearchParams();
  const chatParam = searchParams.get(QueryParams.Chat);

  const supportsFloatingChat = CHATBOT_ENABLED && bpi >= FLOATING_CHAT_BP;
  const isDefaultOpenWidth = width >= CHAT_DEFAULT_OPEN_WIDTH;

  // On extra-wide (≥2550px): show by default unless explicitly set to "false"
  // On smaller screens: opt-in behavior (must be "true")
  // On mobile: handled by inline chat, not this hook
  const isChatOpen = isDefaultOpenWidth
    ? chatParam !== 'false' // Default open on extra-wide screens
    : chatParam === 'true'; // Opt-in on tablet/desktop

  const shouldShowFloating = supportsFloatingChat && isChatOpen;

  return {
    shouldShowFloating,
    supportsFloatingChat,
    isChatOpen
  };
};
