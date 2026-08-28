import { ReactNode, TransitionEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useIsPresent } from 'motion/react';
import { cn } from '@/lib/cn';
import {
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
 * its content height (no measurement guesswork, and it follows live content
 * changes such as an error message appearing). Every inactive layer — including
 * one still playing its exit — is pulled out of flow, which is what lets two
 * screens overlap for the length of the swap without the modal jumping to the
 * sum of their heights.
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
  const [animating, setAnimating] = useState(false);
  // The opening measurement is the modal's own size, not a change to ease
  // between — the same skip-first-measure guard `RollingValue` uses. Held in a
  // ref beside the state so `measure` can compare without depending on either.
  const lastHeight = useRef<number>(undefined);

  const measure = useCallback(() => {
    const next = innerRef.current?.offsetHeight;
    if (next === undefined || next === lastHeight.current) return;
    const isFirst = lastHeight.current === undefined;
    lastHeight.current = next;
    setHeight(next);
    if (!isFirst) setAnimating(true);
  }, []);

  useLayoutEffect(measure);

  useEffect(() => {
    const node = innerRef.current;
    if (!node) return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [measure]);

  // Only clip while the box is actually easing — at rest the carrier is exactly
  // its content's height, and a permanent clip would cut off focus rings.
  const onTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.propertyName === 'height' && event.target === event.currentTarget) setAnimating(false);
  };

  const persistent = layers.filter(layer => layer.persistent);
  const activeTransient = layers.find(layer => !layer.persistent && layer.key === activeKey);

  return (
    <div
      className={cn(
        'ease-standard relative transition-[height] duration-350 motion-reduce:transition-none',
        animating && 'overflow-hidden',
        className
      )}
      // `auto` until the first measurement lands, so the body is never boxed to
      // zero on the frame before the observer reports.
      style={{ height: height ?? 'auto' }}
      onTransitionEnd={onTransitionEnd}
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
        'group/step transition-[opacity,transform,visibility] motion-reduce:transition-none',
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
      transition={isPresent ? modalEnterTransition : modalExitTransition}
      aria-hidden={!isPresent}
    >
      {layer.content}
    </motion.div>
  );
}
