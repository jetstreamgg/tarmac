import { useEffect, useState } from 'react';
import { toast as sonnerToast } from 'sonner';
import { cn } from '@/lib/utils';

// Close All button positioned above the toast stack
// Only shows when there are active toasts
// Uses Sonner's getToasts() API with interval checking
export const ToastCloseAll = () => {
  const [hasToasts, setHasToasts] = useState(false);

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

  return (
    <div
      className={cn(
        'animate-in fade-in slide-in-from-bottom-2 fixed z-[41] duration-200',
        // Mobile: Inside toast area (top-right corner)
        'right-8 bottom-8',
        // Desktop: Below the toast stack with more separation
        'md:right-8 md:bottom-2'
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
          // No border or padding on any screen size
          'p-0'
        )}
        aria-label="Close all notifications"
        title="Dismiss all notifications"
      >
        <span>Close All</span>
      </button>
    </div>
  );
};
