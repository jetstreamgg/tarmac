import { ReactNode, useEffect, useId, useRef } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  onBack,
  onClose,
  footer,
  children,
  dataTestId = 'takeover-shell'
}: {
  title: ReactNode;
  badge?: ReactNode;
  /** Optional back control before the title (UX B.3 "Back + ×" chrome). */
  onBack?: () => void;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  dataTestId?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

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

  // Focus management (aria-modal contract): move focus into the dialog on
  // open, wrap Tab/Shift+Tab at the edges, restore the trigger's focus on
  // close. The Tab listener sits on the CONTAINER, not the document — the
  // transaction modal (z-50) portals above this shell with its own Radix
  // focus scope, and a document-level trap would yank focus back out of it.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    container.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusables = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === container)) {
        last.focus();
        event.preventDefault();
      } else if (!event.shiftKey && active === last) {
        first.focus();
        event.preventDefault();
      }
    };
    container.addEventListener('keydown', onKeyDown);
    return () => {
      container.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      data-testid={dataTestId}
      // Same page-background recipe as the shell surface (shellLayoutClasses):
      // `bg-background` is undefined in the dark scope (known token gap) and
      // would leave the overlay transparent.
      className="bg-app-background light:bg-blend-normal fixed inset-0 z-40 flex flex-col [background-color:#040434] bg-cover bg-center bg-no-repeat bg-blend-luminosity"
    >
      <div className="border-glassBorder flex items-center justify-between gap-4 border-b px-5 py-3 md:border-b-0 md:px-8 md:py-6 lg:px-16">
        <div className="flex items-center gap-2 md:gap-3">
          {onBack && (
            <Button
              variant="secondary"
              size="iconM"
              onClick={onBack}
              aria-label="Back"
              data-testid={`${dataTestId}-back`}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <h2
            id={titleId}
            className="text-text font-circle text-base leading-[18px] font-medium tracking-[-0.32px] md:font-sans md:text-lg md:leading-normal md:tracking-normal"
          >
            {title}
          </h2>
          {badge && (
            <span className="bg-surfaceAlt text-text md:text-textSecondary font-circle flex h-6 items-center gap-1 rounded-full py-1 pr-2 pl-1 text-xs leading-[14px] font-medium tracking-[-0.24px] md:px-2 md:font-sans md:leading-4 md:tracking-normal">
              {badge}
            </span>
          )}
        </div>
        <Button
          variant="secondary"
          size="iconM"
          onClick={onClose}
          aria-label="Close"
          data-testid={`${dataTestId}-close`}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="scrollbar-hidden md:scrollbar-thin-always flex-1 overflow-y-auto px-3 md:px-4">
        <div className="mx-auto flex w-full max-w-[660px] flex-col gap-3 pt-3 pb-4 md:gap-6 md:pt-0 md:pb-8">
          {children}
        </div>
      </div>

      {footer && (
        <div className="px-3 pt-2 pb-[max(12px,env(safe-area-inset-bottom))] md:px-4 md:py-6">
          <div className="mx-auto flex w-full max-w-[660px] items-center justify-between gap-4 md:gap-6">
            {footer}
          </div>
        </div>
      )}
    </div>
  );
}
