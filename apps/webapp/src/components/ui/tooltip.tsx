import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { useIsTouchDevice } from '@/hooks';
import { cn } from '@/lib/cn';

// Design-system Tooltip (Figma Components/Tooltip 5043:57748). The content
// chrome is the shared recipe of every type — bg-tertiary glass at 16px
// radius, 16px padding — and the base typography is the Simple type
// (5043:58208): Body 7 on fg-primary, 260px max (228px text + padding).
// Titled types (Default 5043:58197) compose a Label 5 heading above
// fg-secondary body copy inside; the DS draws no arrow on any tooltip.

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = ({ open, ...props }: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Root>) => {
  const isTouchDevice = useIsTouchDevice();

  // Force tooltip to be closed on touch devices
  const controlledOpen = isTouchDevice ? false : open;

  return <TooltipPrimitive.Root open={controlledOpen} {...props} />;
};

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipPortal = TooltipPrimitive.Portal;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      // z-101: tooltips are the topmost transient layer — they must clear the
      // app PopoverContent (z-100, e.g. the nav More menu hosting the theme
      // and batch toggles), not just the z-50 dialog/sheet/select tier.
      'bg-bgTertiary text-fgPrimary font-graphik animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-101 max-w-[260px] rounded-2xl p-4 text-[11px] leading-4 font-normal backdrop-blur-[100px]',
      className
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, TooltipPortal };
