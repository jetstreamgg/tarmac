import { ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/cn';
import {
  MODAL_CARRIER_MS,
  MODAL_LAYER_SHIFT_PX,
  modalEnterTransition,
  modalExitTransition
} from '../animation/modalStepMotion';

export type ModalStepCarrierLayer = {
  /** Identity of the screen this layer draws. Setting `activeKey` to it swaps it in. */
  key: string;
  content: ReactNode;
  /**
   * Keep the layer mounted while another one is active. The transaction modal's
   * entry body needs this: it can own the in-flight engine hook whose onSuccess
   * completes the transaction, so unmounting it on a later screen strands the
   * modal in LOADING.
   */
  persistent?: boolean;
  className?: string;
};

/** The exit and entrance legs, in the units CSS wants them. */
const EXIT_CLASSES = 'duration-200 ease-accelerate';
const ENTER_CLASSES = 'duration-200 delay-150 ease-decelerate';

/**
 * The height carrier behind the transaction modal's step changes (Figma
 * 2685:148222). It stacks every screen's body in one box, eases that box
 * between their heights on the 350ms standard curve, and cross-fades the
 * screens inside it — the outgoing one falling away as the incoming one rises.
 *
 * The active layer stays in normal flow, so the box's resting height is simply
 * its content height — no measurement guesswork, and it tracks live content
 * changes for free. Every inactive layer — including one still playing its exit
 * — is pulled out of flow, which is what lets two screens overlap for the length
 * of the swap without the modal jumping to the sum of their heights.
 *
 * Only a step change is EASED, though. The box also has to follow heights that
 * move for ordinary reasons (the opening measurement, a fee resolving, an error
 * message arriving); those land instantly, as they did before this box existed.
 *
 * A persistent layer is animated in CSS rather than by `motion`: wrapping that
 * subtree in a motion component remounts it across re-renders, and the entry
 * body re-registers its portal slot every time it remounts, which loops.
 */
export function ModalStepCarrier({
  activeKey,
  layers,
  className
}: {
  activeKey: string;
  layers: ModalStepCarrierLayer[];
  className?: string;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();
  // Held in a ref beside the state so `measure` can compare without depending on it.
  const lastHeight = useRef<number>(undefined);

  // ONLY a step change eases the box. A height that moves for any other reason —
  // the opening measurement, a fee resolving, an error message arriving — lands
  // instantly, the way it did before this box existed. Easing those too made the
  // modal appear to unfold as its content settled in.
  const [previousKey, setPreviousKey] = useState(activeKey);
  const [stepping, setStepping] = useState(false);
  if (previousKey !== activeKey) {
    // Adjusted during render rather than in an effect: the transition has to be
    // on the element BEFORE the layout effect below writes the new height, or
    // the change lands in the same recalc with nothing to interpolate. The
    // previous key is held in state, not a ref, so this stays safe to replay.
    setPreviousKey(activeKey);
    setStepping(true);
  }

  const measure = useCallback(() => {
    const next = innerRef.current?.offsetHeight;
    if (next === undefined || next === lastHeight.current) return;
    lastHeight.current = next;
    setHeight(next);
  }, []);

  useLayoutEffect(measure);

  useEffect(() => {
    const node = innerRef.current;
    if (!node) return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [measure]);

  useEffect(() => {
    if (!stepping) return;
    // A timer rather than `transitionend`: two steps can share a height, and
    // then no transition runs and no event ever arrives to close the window.
    const id = setTimeout(() => setStepping(false), MODAL_CARRIER_MS + 50);
    return () => clearTimeout(id);
  }, [stepping, activeKey]);

  const persistent = layers.filter(layer => layer.persistent);
  const activeTransient = layers.find(layer => !layer.persistent && layer.key === activeKey);

  return (
    <div
      className={cn(
        // `clip`, and always — not `hidden`, and not only while easing. A parked
        // layer is out of flow but still has a box, so a taller one (the entry
        // body behind the short wallet screen) reaches past the carrier and adds
        // itself to the modal card's scrollable area, which is a scrollbar on a
        // screen that fits. `clip` establishes no scroll container of its own,
        // and the margin leaves room for a focus ring on a child at the edge.
        'ease-standard relative overflow-clip [overflow-clip-margin:4px]',
        stepping && 'transition-[height] duration-350 motion-reduce:transition-none',
        className
      )}
      // `auto` until the first measurement lands, so the body is never boxed to
      // zero on the frame before the observer reports.
      style={{ height: height ?? 'auto' }}
    >
      <div ref={innerRef}>
        {persistent.map(layer => (
          <PersistentLayer key={layer.key} layer={layer} active={layer.key === activeKey} />
        ))}
        <AnimatePresence initial={false}>
          {activeTransient && <TransientLayer key={activeTransient.key} layer={activeTransient} />}
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * A layer that never unmounts: it fades out and is then parked, inert.
 *
 * `invisible` rides the same transition as the fade on purpose — CSS holds
 * `visibility` at `visible` for the whole run and only flips it at the end, so
 * the layer leaves the tab order exactly when it finishes leaving the screen.
 */
function PersistentLayer({ layer, active }: { layer: ModalStepCarrierLayer; active: boolean }) {
  return (
    <div
      className={cn(
        // `translate`, not `transform`: Tailwind v4 compiles `translate-y-*` to
        // the standalone `translate` property, so a transition list naming only
        // `transform` leaves the 20px rise and fall to snap on frame 0.
        // (`MODAL_STEP_EXIT_CLASSES` escapes this because v4 expands
        // `transition-transform` to `transform, translate, scale, rotate`.)
        'group/step transition-[opacity,translate,visibility] motion-reduce:transition-none',
        active
          ? `visible translate-y-0 opacity-100 ${ENTER_CLASSES}`
          : `pointer-events-none invisible absolute inset-x-0 top-0 translate-y-5 opacity-0 ${EXIT_CLASSES}`,
        layer.className
      )}
      data-step={active ? 'active' : 'exiting'}
      aria-hidden={!active}
      inert={!active}
    >
      {layer.content}
    </div>
  );
}

/** A layer that unmounts once it is done leaving. */
function TransientLayer({ layer }: { layer: ModalStepCarrierLayer }) {
  // `useIsPresent` is false for the whole exit — exactly the window this layer
  // must not take part in layout, so the incoming one sizes the carrier alone.
  const isPresent = useIsPresent();
  // `motion` honours no reduced-motion preference on its own (the app sets no
  // `MotionConfig`), and its CSS-driven sibling above does — so without this the
  // two halves of one swap disagree. Zero duration, not no animation, so
  // AnimatePresence still gets the exit it needs to unmount on.
  const reducedMotion = useReducedMotion();
  const transition = reducedMotion ? { duration: 0 } : isPresent ? modalEnterTransition : modalExitTransition;
  return (
    <motion.div
      className={cn(
        'group/step',
        !isPresent && 'pointer-events-none absolute inset-x-0 top-0',
        layer.className
      )}
      data-step={isPresent ? 'active' : 'exiting'}
      initial={{ opacity: 0, y: MODAL_LAYER_SHIFT_PX }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: MODAL_LAYER_SHIFT_PX }}
      transition={transition}
      aria-hidden={!isPresent}
    >
      {layer.content}
    </motion.div>
  );
}
