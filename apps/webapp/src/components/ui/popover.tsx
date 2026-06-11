import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { motion } from 'motion/react';

import { cn } from '@/lib/cn';
// Leaf-safe animation tokens (motion presets/labels — no app graph). Used only
// by the widget popover variant below; candidate to relocate to a neutral tokens
// home in the convergence follow-up.
import { AnimationLabels } from '@/widgets/shared/animation/constants';
import { cardInAnimate, cardInInitial } from '@/widgets/shared/animation/presets';

// Plain Radix aliases — identical across both trees, shared as-is.
const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverPortal = PopoverPrimitive.Portal;
const PopoverAnchor = PopoverPrimitive.Anchor;
const PopoverClose = PopoverPrimitive.Close;
const PopoverArrow = PopoverPrimitive.Arrow;

/* App popover content (canonical `PopoverContent`) — original components/ui look.
 * UNCHANGED. No border, wider (w-80), rounded-xl, z-100, no entrance animation. */
const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'center', sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'bg-container text-text data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-100 max-h-(--radix-popover-content-available-height) outline-hidden w-80 rounded-xl p-4 shadow-md',
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));

PopoverContent.displayName = PopoverPrimitive.Content.displayName;

/* Widget popover content (`PopoverWidgetContent`) — original widgets look,
 * preserved verbatim per ticket A1's preserve-both decision (bordered, narrower
 * w-72, rounded-md, z-50, with a motion entrance animation). Exposed via the
 * widget shim as `PopoverContent`. */
const PopoverWidgetContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'center', sideOffset = 4, children, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'bg-container text-text data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 outline-hidden z-50 w-72 rounded-md border p-4 shadow-md',
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
