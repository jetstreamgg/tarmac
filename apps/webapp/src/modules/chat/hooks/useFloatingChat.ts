import { useSearchParams } from 'react-router-dom';
import { useBreakpointIndex, BP } from '@/modules/ui/hooks/useBreakpointIndex';
import { QueryParams } from '@/lib/constants';

/**
 * Hook to determine if floating chat should be shown
 * Floating chat is shown on wide screens (3xl+) when chat param is true
 */
export const useFloatingChat = () => {
  const { bpi } = useBreakpointIndex();
  const [searchParams] = useSearchParams();
  const isChatOpen = searchParams.get(QueryParams.Chat) === 'true';

  // Show floating chat on wide screens (3xl / 1680px and above) when chat is open
  const shouldShowFloating = bpi >= BP['3xl'] && isChatOpen;

  return {
    shouldShowFloating,
    supportsFloatingChat: bpi >= BP['3xl'],
    isChatOpen
  };
};
