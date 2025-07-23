import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

import { cn, useIsTouchDevice } from '@/lib/utils';

const TooltipProvider = TooltipPrimitive.Provider;

const TooltipRoot = TooltipPrimitive.Root;

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

// Wrapper for Tooltip that adds touch support
const Tooltip: React.FC<
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Root> & {
    touchAutoCloseDelay?: number; // in milliseconds, undefined = no auto-close
  }
> = ({
  children,
  open: controlledOpen,
  onOpenChange,
  touchAutoCloseDelay = 30000, // default 30 seconds
  ...props
}) => {
  const isTouchDevice = useIsTouchDevice();
  const [internalOpen, setInternalOpen] = React.useState(false);
  const touchTimerRef = React.useRef<NodeJS.Timeout | undefined>(undefined);
  const openTimerRef = React.useRef<NodeJS.Timeout | undefined>(undefined);

  // If it's a touch device and no controlled state, use our internal state
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : isTouchDevice ? internalOpen : undefined;
  const handleOpenChange = React.useCallback(
    (newOpen: boolean) => {
      if (onOpenChange) {
        onOpenChange(newOpen);
      }
      if (!isControlled && isTouchDevice) {
        setInternalOpen(newOpen);
      }
    },
    [onOpenChange, isControlled, isTouchDevice]
  );

  React.useEffect(() => {
    return () => {
      if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
      if (openTimerRef.current) clearTimeout(openTimerRef.current);
    };
  }, []);

  const handleTouch = React.useCallback(() => {
    if (!isTouchDevice || isControlled) return;

    // Clear any existing timers
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    if (openTimerRef.current) clearTimeout(openTimerRef.current);

    // Toggle the tooltip
    if (!internalOpen) {
      setInternalOpen(true);
      // Auto-close after specified delay (if touchAutoCloseDelay is set)
      if (touchAutoCloseDelay !== undefined && touchAutoCloseDelay > 0) {
        touchTimerRef.current = setTimeout(() => {
          setInternalOpen(false);
        }, touchAutoCloseDelay);
      }
    } else {
      setInternalOpen(false);
    }
  }, [isTouchDevice, isControlled, internalOpen, touchAutoCloseDelay]);

  // Clone children and add touch handlers to TooltipTrigger
  const modifiedChildren = React.Children.map(children, child => {
    if (React.isValidElement(child) && child.type === TooltipTrigger) {
      const triggerProps = child.props as React.ComponentPropsWithoutRef<typeof TooltipTrigger>;

      if (isTouchDevice && !isControlled) {
        // For touch devices, we need to intercept the click/touch
        if (triggerProps.asChild && React.isValidElement(triggerProps.children)) {
          return React.cloneElement(child as React.ReactElement<any>, {
            ...triggerProps,
            children: React.cloneElement(triggerProps.children as React.ReactElement<any>, {
              onClick: (e: React.MouseEvent) => {
                e.preventDefault();
                handleTouch();
              }
            })
          });
        } else {
          return React.cloneElement(child as React.ReactElement<any>, {
            ...triggerProps,
            onClick: (e: React.MouseEvent) => {
              e.preventDefault();
              handleTouch();
            }
          });
        }
      }
    }
    return child;
  });

  return (
    <TooltipRoot
      open={open}
      onOpenChange={handleOpenChange}
      delayDuration={isTouchDevice ? 0 : props.delayDuration}
      {...props}
    >
      {modifiedChildren}
    </TooltipRoot>
  );
};

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, TooltipArrow, TooltipPortal };
