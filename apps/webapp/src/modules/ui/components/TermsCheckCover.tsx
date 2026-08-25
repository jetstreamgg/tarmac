import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Trans } from '@lingui/react/macro';
import { SkyLogomarkSpinner } from '@/modules/app/components/SkyLogomarkSpinner';
import { easeInOutQuart, easeOutQuint } from '../animation/timingFunctions';

/** The dialog scrim's own fade, in seconds (`components/ui/dialog.tsx`). */
const FADE_S = 0.3;

/**
 * The gap between "wallet connected" and "we know what to ask you": the terms
 * `/check` is in flight and there is nothing to put in a card yet.
 *
 * It wears the DialogOverlay's scrim recipe and the App Loader's logomark, so
 * the terms modal's own overlay takes over from an identical layer and the
 * card is the only thing that arrives — rising 40px like every other modal in
 * the app. The two scrims cross-fade on the same 300ms the dialog uses, which
 * is why this one animates its exit rather than unmounting on the spot.
 *
 * It replaces a 300px "Please wait" card that grew into the 610px terms card
 * once the check landed, usually mid-entrance: the modal read as opening
 * outward from its centre instead of sliding up.
 *
 * Portalled to the body: this renders from the navbar's wallet slot, whose
 * backdrop-filtered ancestor would otherwise become the containing block of a
 * `fixed` child and trap the scrim inside the header.
 */
export function TermsCheckCover({ open }: { open: boolean }) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="terms-check-cover"
          role="status"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: FADE_S, ease: easeOutQuint } }}
          exit={{ opacity: 0, transition: { duration: FADE_S, ease: easeInOutQuart } }}
          className="bg-modalOverlay fixed inset-0 z-50 flex items-center justify-center backdrop-blur-[100px]"
          data-testid="terms-check-cover"
        >
          <SkyLogomarkSpinner />
          <span className="sr-only">
            <Trans>Checking your terms acceptance</Trans>
          </span>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
