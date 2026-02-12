import { useEffect, useState } from 'react';
import { toast as sonnerToast } from 'sonner';
import { cn } from '@/lib/utils';
import { useBreakpointIndex, BP } from '@/modules/ui/hooks/useBreakpointIndex';
import { FLOATING_CHAT_BP } from '@/modules/chat/hooks/useFloatingChat';

// Close All button positioned above the toast stack
// Only shows when there are active toasts
// Uses Sonner's getToasts() API with interval checking
export const ToastCloseAll = () => {
  const [hasToasts, setHasToasts] = useState(false);
  const { bpi } = useBreakpointIndex();

  useEffect(() => {
    // Check for active toasts using Sonner's API
    const checkToasts = () => {
      const activeToasts = sonnerToast.getToasts();
      setHasToasts(activeToasts.length > 1);
    };

    // Initial check
    checkToasts();

    // Set up interval to check for toasts
    // 100ms is frequent enough for responsive UI without performance impact
    const interval = setInterval(checkToasts, 500);

    return () => {
      clearInterval(interval);
    };
  }, []);

  if (!hasToasts) return null;
  const isWideScreen = bpi >= FLOATING_CHAT_BP;
  const isMobile = bpi < BP.md;
  return (
    <div
      className={cn(
        'animate-in fade-in fixed z-[41] duration-200',
        // Wide screens (3xl+): Bottom-right corner of toast stack (toast width is 420px, centered at 50vw)
        // Smaller screens: Bottom-right as before
        isWideScreen
          ? 'fade-in slide-in-from-top-2 left-92.5 bottom-3'
          : isMobile
            ? 'fade-in slide-in-from-bottom-2 bottom-7 right-8'
            : 'fade-in slide-in-from-bottom-2 bottom-1 right-8'
      )}
    >
      <button
        onClick={() => {
          const activeToasts = sonnerToast.getToasts();
          // Dismiss each toast individually by ID
          activeToasts.forEach(toast => {
            if (toast.id) {
              sonnerToast.dismiss(toast.id);
            }
          });
          setHasToasts(false);
        }}
        className={cn(
          'text-text/70 hover:text-text bg-transparent',
          'flex items-center gap-1 rounded-md',
          'text-xs font-medium',
          'hover:bg-container/30 transition-all',
          isMobile ? 'p-0' : 'px-2 py-1'
        )}
        aria-label="Close all notifications"
        title="Dismiss all notifications"
      >
        <span>Close All</span>
      </button>
    </div>
  );
};
