import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Full-screen takeover chrome (hi-fi 486:32657): header row with title + badge
 * and a close button, a scrollable centered card column, and a sticky footer.
 * The one sanctioned ProductDetailTemplate exception (Migration Mechanics §5) —
 * layout + slots only, no data fetching. Sits at z-40 so the transaction modal
 * (z-50) stacks above it.
 */
export function TakeoverShell({
  title,
  badge,
  onClose,
  footer,
  children,
  dataTestId = 'takeover-shell'
}: {
  title: ReactNode;
  badge?: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  dataTestId?: string;
}) {
  // Escape-to-close + document scroll lock: syncing with the DOM outside React.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.documentElement.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid={dataTestId}
      // Same page-background recipe as the shell surface (shellLayoutClasses):
      // `bg-background` is undefined in the dark scope (known token gap) and
      // would leave the overlay transparent.
      className="bg-app-background light:bg-blend-normal fixed inset-0 z-40 flex flex-col [background-color:#040434] bg-cover bg-center bg-no-repeat bg-blend-luminosity"
    >
      <div className="flex items-center justify-between gap-4 px-8 py-6 lg:px-16">
        <div className="flex items-center gap-3">
          <h2 className="text-text text-lg font-medium">{title}</h2>
          {badge && (
            <span className="bg-surfaceAlt text-textSecondary flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium">
              {badge}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close"
          data-testid={`${dataTestId}-close`}
          className="bg-surfaceAlt h-9 w-9 rounded-full"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4">
        <div className="mx-auto flex w-full max-w-[660px] flex-col gap-6 pb-8">{children}</div>
      </div>

      {footer && (
        <div className="px-4 py-6">
          <div className="mx-auto flex w-full max-w-[660px] items-center justify-between gap-6">{footer}</div>
        </div>
      )}
    </div>
  );
}
