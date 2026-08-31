import { ReactNode, useLayoutEffect, useRef, useState } from 'react';
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
    // The box always hugs its content, centred or not: a `w-full` centred label
    // would claim the CTA's whole remaining width and centre its text within
    // THAT, so the wording visibly shifts sideways the moment a loading spinner
    // joins it in the button. Both copies share a centre via the pin below.
    <span className={cn('relative inline-flex min-w-0', className)}>
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

  // ...but out of flow it would still be SIZED by that container, and the
  // incoming string is usually the shorter one: "Supply to Sky Savings" was
  // being squeezed into "Review supply"'s 114px and re-wrapping to two lines
  // halfway through its own fade. So each copy records the width it occupies
  // while it is the one in flow, and wears it on the way out. Measured from the
  // render before the swap, which is the last one where this copy sized the box.
  const nodeRef = useRef<HTMLSpanElement>(null);
  const flowWidth = useRef<number>(undefined);
  // Promoted to state for the render to read: a ref read during render isn't
  // safe to replay. The handover happens in a layout effect, so the width is on
  // the element before the browser paints the frame it left flow on.
  const [exitWidth, setExitWidth] = useState<number>();
  // Re-measured on every render it is present for, not just on mount: the same
  // copy can be re-worded in place (a live `updateModalContent` retitle, a CTA
  // label swapping to "Connect wallet") or reflow when the webfont lands.
  useLayoutEffect(() => {
    if (isPresent && nodeRef.current) flowWidth.current = nodeRef.current.getBoundingClientRect().width;
  });
  // Handed over once, on the commit that takes this copy out of flow.
  useLayoutEffect(() => {
    if (!isPresent && exitWidth === undefined && flowWidth.current !== undefined) {
      setExitWidth(flowWidth.current);
    }
  }, [isPresent, exitWidth]);

  return (
    <motion.span
      ref={nodeRef}
      style={!isPresent && exitWidth !== undefined ? { width: exitWidth } : undefined}
      className={cn(
        'block min-w-0',
        // A start-aligned label WRAPS, as the plain title did before it was
        // routed through here — a `truncate` would silently ellipsize any title
        // that outgrows one line, which the mobile sheet and longer translations
        // both reach. A centred one is a CTA's wording, which never wraps.
        align === 'center' && 'whitespace-nowrap',
        !isPresent && 'pointer-events-none absolute top-0',
        // Pinned on the box's centre rather than its edges, so the outgoing copy
        // stays centred even though the incoming string has already resized the
        // box around it. (Tailwind's `-translate-x-1/2` lands on `translate`,
        // which composes with the `transform` motion animates — they don't
        // clobber each other.)
        !isPresent && (align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-0')
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
      // The clip is what makes the width animation read as a slot opening, but
      // it also sits right on the button's left edge — hence `clip` with a
      // margin wide enough for its focus ring (2px ring + 2px offset) rather
      // than `hidden`, which would shear the ring off for keyboard users.
      className="shrink-0 overflow-clip [overflow-clip-margin:4px]"
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
