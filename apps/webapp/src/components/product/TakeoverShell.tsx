import { ReactNode, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'motion/react';
import { ChevronLeft, X } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { Button } from '@/components/ui/button';

/**
 * The takeover opens and closes on the modal comp's motion (Figma: Sky App: UI
 * 1598:75901): the scrim fades while the card column rises 40px, 300ms,
 * arriving on quint and leaving on quart. The scrim itself does not travel —
 * it covers the viewport, so translating it would uncover an edge.
 *
 * Callers must render the takeover inside an `AnimatePresence` for the exit
 * half to run; without one it is unmounted the instant the flow closes.
 */
const SCRIM_IN = { duration: 0.3, ease: [0.23, 1, 0.32, 1] } as const;
const SCRIM_OUT = { duration: 0.3, ease: [0.77, 0, 0.175, 1] } as const;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Full-screen takeover chrome (hi-fi 486:32657, restyled to 1036:209505):
 * header row with title + badge and a close button over a scrollable centered
 * card column that ends with the footer row. The one sanctioned
 * ProductDetailTemplate exception (Migration Mechanics §5) — layout + slots
 * only, no data fetching. Sits at z-[46]: above the bottom-anchored app
 * overlays (cookie banner z-40, extensible Banner z-[45]), below the
 * transaction modal (z-50).
 */
export function TakeoverShell({
  title,
  badge,
  onBack,
  onClose,
  footer,
  locked = false,
  onOpenTransaction,
  children,
  dataTestId = 'takeover-shell'
}: {
  title: ReactNode;
  badge?: ReactNode;
  /** Optional back control before the title (UX B.3 "Back + ×" chrome). */
  onBack?: () => void;
  onClose: () => void;
  footer?: ReactNode;
  /**
   * The form's own transaction is minimized (APP-448): the card column goes
   * inert and dimmed, and the footer offers to reopen it instead.
   */
  locked?: boolean;
  onOpenTransaction?: () => void;
  children: ReactNode;
  dataTestId?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const reduceMotion = useReducedMotion();

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

  // Portalled to the body because the page wrapper carries a
  // `view-transition-name` (see the page-transition rules in globals.css), and
  // a named element breaks `backdrop-filter` for its descendants: rendered in
  // place, this shell's scrim and blur simply stopped painting and the live
  // page read straight through the takeover. A full-screen modal belongs at the
  // body anyway — the dialog and sheet overlays it shares its recipe with are
  // both portalled — and that also keeps it out of reach of any future
  // transform/filter ancestor.
  return createPortal(
    <motion.div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      data-testid={dataTestId}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: reduceMotion ? { duration: 0 } : SCRIM_OUT }}
      transition={reduceMotion ? { duration: 0 } : SCRIM_IN}
      // The comps draw the takeover as a full-page MODAL over the live page
      // (APP-432 item 21 — 1036:209505 layers it over `bg-modal`, a render of
      // /earn), not as a second opaque page: same scrim + blur recipe as the
      // dialog and sheet overlays. It previously repainted the app background,
      // which hid the page underneath entirely.
      className="bg-modalOverlay fixed inset-0 z-[46] flex flex-col backdrop-blur-[100px]"
    >
      <div className="border-glassBorder flex items-center justify-between gap-4 border-b px-5 py-3 md:px-10 md:py-5">
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
          {/* Label 4 on phones, Label 3 from md up (1369:44362). */}
          <h2
            id={titleId}
            className="text-text font-circle text-base leading-[18px] font-medium tracking-[-0.32px] md:text-lg md:leading-[22px] md:tracking-[-0.36px]"
          >
            {title}
          </h2>
          {badge && (
            // Badges / Illustration (I1369:44421): glass pill, 4px inset around
            // a 16px logo, Label 6 on fg-primary — one recipe at every tier.
            <span className="bg-glassBadge text-text font-circle flex items-center gap-1 rounded-[20px] py-1 pr-2 pl-1 text-xs leading-[14px] font-medium tracking-[-0.24px]">
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

      {/* 610px column, 12px between cards, 64px of air under the header
          (1036:209509). The footer is the column's last row rather than a
          sticky bar — the comps scroll it with the content. */}
      <div className="flex-1 overflow-y-auto px-3 md:px-4">
        <motion.div
          className="mx-auto flex w-full max-w-[610px] flex-col gap-3 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] md:pt-16 md:pb-16"
          initial={{ y: 40 }}
          animate={{ y: 0 }}
          exit={{ y: 40, transition: reduceMotion ? { duration: 0 } : SCRIM_OUT }}
          transition={reduceMotion ? { duration: 0 } : SCRIM_IN}
        >
          <div
            inert={locked}
            className={locked ? 'flex flex-col gap-3 opacity-50' : 'flex flex-col gap-3'}
            data-testid={`${dataTestId}-form`}
          >
            {children}
          </div>
          {(locked || footer) && (
            <div className="flex items-center justify-between gap-4 px-2 py-4 md:gap-6 md:px-6 md:py-6">
              {locked ? (
                <>
                  <p className="text-textSecondary max-w-xs text-sm">
                    <Trans>A transaction is in progress. Open it to continue.</Trans>
                  </p>
                  <Button
                    variant="primary"
                    size="xl"
                    onClick={onOpenTransaction}
                    data-testid={`${dataTestId}-open-transaction`}
                    className="px-10"
                  >
                    <Trans>Open transaction</Trans>
                  </Button>
                </>
              ) : (
                footer
              )}
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>,
    document.body
  );
}
