import { cubicBezier } from 'motion/react';

/**
 * Transaction-modal step timeline (Figma 2685:148222).
 *
 * The prototype is one looping 3.35s timeline covering both step changes —
 * entry → review (800-1150ms) and review → wallet/status (2000-2400ms). Both
 * legs are built from the same four curves and the same three-beat schedule,
 * so they are extracted here as tokens rather than re-derived per surface:
 *
 *   beat 0 (t+0ms)    exits + the carrier (height, back-button slot, title shift)
 *   beat 1 (t+100ms)  label cross-fades (modal title, CTA label)
 *   beat 2 (t+150ms)  entrances
 *
 * The carrier runs the full 350ms while every leg inside it runs 200ms, which
 * is what stops the height change from reading as a jump: the box is still
 * easing after the content has finished swapping.
 */

/** Size + position: the modal's height, the title's shift, the back-button slot. */
export const easeStandard = cubicBezier(0.4, 0, 0.2, 1);
/** Anything leaving: it starts at rest and accelerates off. */
export const easeAccelerate = cubicBezier(0.4, 0, 1, 1);
/** Anything arriving: it enters fast and settles. */
export const easeDecelerate = cubicBezier(0, 0, 0.2, 1);
/** The blurred label roll (modal title, CTA label) — symmetric for in and out. */
export const easeLabelCross = cubicBezier(0.4, 0, 0.25, 1);

/** Seconds, matching `motion`'s unit. */
export const MODAL_CARRIER_S = 0.35;
export const MODAL_LEG_S = 0.2;
export const MODAL_LABEL_DELAY_S = 0.1;
export const MODAL_ENTER_DELAY_S = 0.15;

/**
 * Vertical travel for a body layer. Figma draws the outgoing entry grid at 46px
 * and everything else at 20px; the extra 26px there is the layout reflow of a
 * frame whose children are all absolutely positioned, which flow layout under
 * an animated carrier gives us for free. 20px is the real token.
 */
export const MODAL_LAYER_SHIFT_PX = 20;
/** Label roll distance — roughly one line box of the 18/22 title. */
export const MODAL_LABEL_SHIFT_PX = 16;
export const MODAL_LABEL_BLUR_PX = 4;
/** 40px icon button + the header row's 16px gap. */
export const MODAL_BACK_SLOT_PX = 56;
/** How far the back button slides in from, ahead of its slot opening. */
export const MODAL_BACK_SHIFT_PX = 20;

/**
 * Every body layer is a `group/step` carrying `data-step="active" | "exiting"`,
 * so the shared pieces inside one (the amount field, say) can choreograph their
 * own departure without the carrier reaching into them or a context threading
 * a phase down. Pair with `MODAL_STEP_EXIT_CLASSES` on the moving element.
 */
export const MODAL_STEP_EXIT_CLASSES =
  'transition-transform duration-200 ease-accelerate motion-reduce:transition-none';

export const modalCarrierTransition = { duration: MODAL_CARRIER_S, ease: easeStandard };
export const modalExitTransition = { duration: MODAL_LEG_S, ease: easeAccelerate };
export const modalEnterTransition = {
  duration: MODAL_LEG_S,
  ease: easeDecelerate,
  delay: MODAL_ENTER_DELAY_S
};
