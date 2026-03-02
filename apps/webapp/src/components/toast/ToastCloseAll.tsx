import { useEffect, useState } from 'react';
import { toast as sonnerToast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCookieConsent } from '@/modules/analytics/context/CookieConsentContext';

const BANNER_BOTTOM_MARGIN = 16;
const BANNER_TOAST_GAP = 12;

// Close All button positioned above the toast stack
// Only shows when there are active toasts
// Uses Sonner's getToasts() API with interval checking
export const ToastCloseAll = () => {
  const { bannerHeight } = useCookieConsent();
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
        bannerHeight > 0 ? 'right-10 pb-1' : 'right-10 bottom-8 pb-1 md:right-8 md:bottom-2 md:pb-0'
      )}
      style={
        bannerHeight > 0
          ? { bottom: BANNER_BOTTOM_MARGIN + bannerHeight + BANNER_TOAST_GAP }
          : undefined
      }
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
