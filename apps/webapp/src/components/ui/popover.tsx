import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { motion } from 'motion/react';

import { cn } from '@/lib/cn';
// Leaf-safe motion tokens (no app graph) — used only by the widget popover below.
import { AnimationLabels } from '@/widgets/shared/animation/constants';
import { cardInAnimate, cardInInitial } from '@/widgets/shared/animation/presets';

// Shared Radix aliases (identical in both trees).
const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverPortal = PopoverPrimitive.Portal;
const PopoverAnchor = PopoverPrimitive.Anchor;
const PopoverClose = PopoverPrimitive.Close;
const PopoverArrow = PopoverPrimitive.Arrow;

// The stock open/close motion (tailwindcss-animate zoom + fade + slide).
// Kept separate so a caller can opt out and bring its own `animate-*`
// utilities: tailwind-merge has no group for `animate-in` vs a custom
// `animate-foo`, so both would survive `cn` and the stock longhands (emitted
// later in the stylesheet) would win.
const popoverMotionClasses =
  'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2';

// App look — canonical, unchanged.
const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> & {
    /** Pass `false` to drop the stock motion and supply your own via className. */
    animated?: boolean;
  }
>(({ className, align = 'center', sideOffset = 4, collisionPadding = 8, animated = true, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      className={cn(
        'bg-container text-text z-100 max-h-(--radix-popover-content-available-height) w-80 max-w-[min(var(--radix-popover-content-available-width),calc(100vw_-_2rem))] rounded-xl p-4 shadow-md outline-hidden',
        animated && popoverMotionClasses,
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));

PopoverContent.displayName = PopoverPrimitive.Content.displayName;

// Widget look — relocated as PopoverWidgetContent; the widgets/popover shim aliases it back.
const PopoverWidgetContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'center', sideOffset = 4, collisionPadding = 8, children, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      className={cn(
        'bg-container text-text data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-72 max-w-[min(var(--radix-popover-content-available-width),calc(100vw_-_2rem))] rounded-md border p-4 shadow-md outline-hidden',
        className
      )}
      asChild
      {...props}
    >
      <motion.div
        variants={{
          [AnimationLabels.initial]: cardInInitial,
          [AnimationLabels.animate]: cardInAnimate
        }}
        initial={AnimationLabels.initial}
        animate={AnimationLabels.animate}
      >
        {children}
      </motion.div>
    </PopoverPrimitive.Content>
  </PopoverPrimitive.Portal>
));
PopoverWidgetContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent, PopoverClose, PopoverArrow };
export { PopoverWidgetContent, PopoverPortal, PopoverAnchor };
