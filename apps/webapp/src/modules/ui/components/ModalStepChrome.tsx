import { ReactNode } from 'react';
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/cn';
import {
  MODAL_BACK_SHIFT_PX,
  MODAL_BACK_SLOT_PX,
  MODAL_CARRIER_S,
  MODAL_LABEL_BLUR_PX,
  MODAL_LABEL_DELAY_S,
  MODAL_LABEL_SHIFT_PX,
  MODAL_LEG_S,
  easeAccelerate,
  easeDecelerate,
  easeLabelCross,
  easeStandard
} from '@/modules/ui/animation/modalStepMotion';

/**
 * The transaction modal's step-change chrome (Figma 2685:148222): the title's
 * blurred roll, the back arrow's opening slot, and the Actions hairline that
 * draws itself in. Grouped because they share one timeline — the body's swap
 * lives in `ModalStepCarrier`.
 */

/**
 * A label that rolls when its key changes: the outgoing string lifts one line
 * box and blurs out while the incoming one rises into its place, both on the
 * same 200ms window. Used by the modal title ("Supply to Sky Savings" → "Review
 * supply" → "Confirm in the wallet") and by the primary CTA's label.
 *
 * Both strings occupy the same box for the length of the cross-fade — the
 * outgoing one is taken out of flow so the incoming one sizes the container,
 * which is what lets a title grow or shrink without the row reflowing twice.
 */
export function ModalStepLabel({
  labelKey,
  children,
  className,
  align = 'start'
}: {
  /** Change this to trigger the roll. */
  labelKey: string;
  children: ReactNode;
  className?: string;
  /** How the outgoing copy is pinned while it is out of flow. */
  align?: 'start' | 'center';
}) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return <span className={className}>{children}</span>;
  }

  return (
    // Centred labels fill their box (a full-width CTA) so both copies share one
    // centre and the outgoing one doesn't jump when the incoming string resizes
    // the container. Start-aligned ones hug their text and truncate.
    <span className={cn('relative inline-flex min-w-0', align === 'center' && 'w-full', className)}>
      <AnimatePresence initial={false}>
        <ModalStepLabelCopy key={labelKey} align={align}>
          {children}
        </ModalStepLabelCopy>
      </AnimatePresence>
    </span>
  );
}

function ModalStepLabelCopy({ children, align }: { children: ReactNode; align: 'start' | 'center' }) {
  // `useIsPresent` is false for the whole exit, which is exactly the window the
  // outgoing copy must not take part in layout — pinning it here keeps the
  // container sized by the incoming string alone.
  const isPresent = useIsPresent();
  return (
    <motion.span
      className={cn(
        'block min-w-0 truncate',
        align === 'center' && 'w-full text-center',
        !isPresent && 'pointer-events-none absolute top-0 left-0',
        !isPresent && align === 'center' && 'right-0'
      )}
      initial={{ opacity: 0, y: MODAL_LABEL_SHIFT_PX, filter: `blur(${MODAL_LABEL_BLUR_PX}px)` }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -MODAL_LABEL_SHIFT_PX, filter: `blur(${MODAL_LABEL_BLUR_PX}px)` }}
      transition={{ duration: MODAL_LEG_S, ease: easeLabelCross, delay: MODAL_LABEL_DELAY_S }}
      aria-hidden={!isPresent}
    >
      {children}
    </motion.span>
  );
}

/**
 * The back arrow's slot in the modal header.
 *
 * Two motions, deliberately different: the slot itself opens to 56px (the 40px
 * button plus the header row's 16px gutter) on the 350ms standard curve, which is
 * what carries the title sideways to make room; the button rides in on the
 * decelerate curve from 20px left of its resting place, so the glyph arrives
 * before the space around it has finished settling.
 */
export function ModalStepBackSlot({ open, children }: { open: boolean; children: ReactNode }) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return open ? <div className="mr-4 shrink-0">{children}</div> : null;
  }

  return (
    <motion.div
      className="shrink-0 overflow-hidden"
      initial={false}
      animate={{ width: open ? MODAL_BACK_SLOT_PX : 0 }}
      transition={{ duration: MODAL_CARRIER_S, ease: easeStandard }}
    >
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="mr-4"
            initial={{ opacity: 0, x: -MODAL_BACK_SHIFT_PX }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -MODAL_BACK_SHIFT_PX }}
            transition={{ duration: MODAL_CARRIER_S, ease: easeDecelerate }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * The hairline above the Actions list. Figma animates it as a path length rather
 * than a fade — it wipes in from the left, last of everything on the wallet
 * screen, once the step rows have already arrived.
 */
export function ModalStepDivider() {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      className="border-borderPrimary origin-left border-t"
      initial={reducedMotion ? false : { scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={{ duration: 0.15, ease: easeAccelerate, delay: 0.3 }}
    />
  );
}
