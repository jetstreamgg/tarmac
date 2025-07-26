import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { useIsTouchDevice } from '@jetstreamgg/sky-utils';

import { cn } from '@widgets/lib/utils';

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = ({ open, ...props }: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Root>) => {
  const isTouchDevice = useIsTouchDevice();

  // Force tooltip to be closed on touch devices
  const controlledOpen = isTouchDevice ? false : open;

  return <TooltipPrimitive.Root open={controlledOpen} {...props} />;
};

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipArrow = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Arrow>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Arrow>
>(({ className, ...props }, ref) => (
  <TooltipPrimitive.Arrow ref={ref} className={cn('fill-container', className)} {...props} />
));

const TooltipPortal = TooltipPrimitive.Portal;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      'bg-container text-text animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 rounded-md px-3 py-1.5 text-sm shadow-md backdrop-blur-[50px]',
      className
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, TooltipArrow, TooltipPortal };
