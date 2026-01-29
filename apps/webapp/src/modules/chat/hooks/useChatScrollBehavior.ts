import { useState, useEffect } from 'react';

/**
 * Hook to manage chat scroll behavior with a delayed transition.
 * On mount or when isChatOpen changes, uses 'auto' scroll (instant),
 * then switches to 'smooth' after 1500ms.
 * This prevents jarring scroll animations when opening chat with existing messages.
 *
 * @param isChatOpen - Optional boolean to trigger reset when chat opens/closes
 */
export const useChatScrollBehavior = (isChatOpen?: boolean): ScrollBehavior => {
  const [scrollBehavior, setScrollBehavior] = useState<ScrollBehavior>('auto');

  useEffect(() => {
    // Only run the transition when chat is open (or if isChatOpen is not provided)
    if (isChatOpen === false) return;

    // Start with instant scroll
    setScrollBehavior('auto');

    // Switch to smooth scroll after 1500ms
    const timer = setTimeout(() => {
      setScrollBehavior('smooth');
    }, 1500);

    return () => clearTimeout(timer);
  }, [isChatOpen]);

  return scrollBehavior;
};
