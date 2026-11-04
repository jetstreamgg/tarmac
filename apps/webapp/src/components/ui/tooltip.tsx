import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { useIsTouchDevice } from '@/hooks';
import { cn } from '@/lib/cn';

// Design-system Tooltip (Figma Components/Tooltip 5043:57748, unified per
// 4147:65246). The content chrome is the shared recipe of every type —
// bg-tertiary glass at 16px radius, 16px padding, and a CSS `blur(20px)`
// backdrop (the DS `background blur-2xl`; Figma states background blur at
// twice the CSS value). Body copy is Body 7 on
// fg-secondary for every tooltip, titled or not, 260px max (228px text +
// padding); titled ones (Default 5043:58197) add a Label 5 fg-primary heading
// above it. The DS draws no arrow and no close button.
//
// z-101: tooltips are the topmost transient layer — they must clear the app
// PopoverContent (z-100, e.g. the nav More menu hosting the theme and batch
// toggles), not just the z-50 dialog/sheet/select tier.
export const TOOLTIP_SURFACE_CLASSES =
  'bg-bgTertiary text-fgSecondary font-graphik z-101 max-w-[260px] rounded-2xl p-4 text-[11px] leading-4 font-normal backdrop-blur-[20px] outline-hidden';

const TOOLTIP_MOTION_CLASSES =
  'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2';

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = ({ open, ...props }: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Root>) => {
  const isTouchDevice = useIsTouchDevice();

  // Touch devices can't hover, so an uncontrolled tooltip stays closed there
  // (use `ResponsiveTooltip` for a tap-open fallback). A caller that controls
  // `open` itself (e.g. the "Copied" confirmation) is respected.
  const controlledOpen = isTouchDevice && open === undefined ? false : open;

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
    className={cn(TOOLTIP_SURFACE_CLASSES, TOOLTIP_MOTION_CLASSES, className)}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

// Every tooltip trigger reads as interactive (it opens on click/tap too);
// Slot merges this onto the trigger element's own classes.
const TRIGGER_CURSOR = 'cursor-pointer';

const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

// Radix closes a tooltip on a pointerdown or click of its trigger; preventing
// default skips that (its handlers bail on `defaultPrevented`), so clicking or
// pressing Enter/Space on a trigger keeps the tooltip open instead of
// dismissing it. The click also must not reach clickable parent rows/cards.
const keepOpen = (e: React.SyntheticEvent) => e.preventDefault();
const keepOpenAndContain = (e: React.SyntheticEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

// Portalled content still bubbles React events up the component tree: clicks
// (e.g. on a copy link) must not reach the trigger's clickable parents, and
// wheel/touch scrolling must work over scroll-locking surfaces (modals).
const contentContainment = {
  onClick: stopPropagation,
  onWheel: stopPropagation,
  onTouchMove: stopPropagation
};

type ResponsiveTooltipProps = {
  /** A single element that accepts a ref and pointer/click handlers (rendered `asChild`). */
  trigger: React.ReactElement;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  contentClassName?: string;
  /**
   * Close as soon as the pointer leaves the trigger and let it through the
   * content: for purely informational content that covers neighbouring
   * targets. Pointer devices only.
   */
  passThrough?: boolean;
};

/**
 * The one tooltip interaction for the app: hover (and keyboard focus) opens
 * the Radix tooltip on pointer devices; touch devices, which can't hover, tap
 * the trigger to open a popover wearing the exact same chrome — no arrow and
 * no close button (tap outside dismisses it).
 */
function ResponsiveTooltip({
  trigger,
  children,
  side = 'top',
  align = 'center',
  contentClassName,
  passThrough = false
}: ResponsiveTooltipProps) {
  const isTouchDevice = useIsTouchDevice();
  const placement = { side, align, sideOffset: 4, collisionPadding: 8 } as const;

  if (isTouchDevice) {
    return (
      <PopoverPrimitive.Root>
        {/* Triggers often sit inside clickable rows/cards: the tap must not reach them. */}
        <PopoverPrimitive.Trigger asChild className={TRIGGER_CURSOR} onClick={stopPropagation}>
          {trigger}
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            {...placement}
            className={cn(
              TOOLTIP_SURFACE_CLASSES,
              TOOLTIP_MOTION_CLASSES,
              'max-h-(--radix-popover-content-available-height) max-w-[min(260px,var(--radix-popover-content-available-width))] overflow-y-auto',
              contentClassName
            )}
            {...contentContainment}
          >
            {children}
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    );
  }

  return (
    // Own provider (same 300ms delay as the app root's, which nests harmlessly
    // under it) so every trigger is self-contained on any surface — pages,
    // cards, full-page takeovers, tests — with no host setup. The raw Root, not
    // `Tooltip`: this branch already knows it isn't on a touch device.
    <TooltipProvider delayDuration={300} disableHoverableContent={passThrough}>
      <TooltipPrimitive.Root>
        <TooltipTrigger
          asChild
          className={TRIGGER_CURSOR}
          onPointerDown={keepOpen}
          onClick={keepOpenAndContain}
        >
          {trigger}
        </TooltipTrigger>
        <TooltipPortal>
          <TooltipContent
            {...placement}
            className={cn(
              'max-h-(--radix-tooltip-content-available-height) overflow-y-auto',
              passThrough && 'pointer-events-none',
              contentClassName
            )}
            {...contentContainment}
          >
            {children}
          </TooltipContent>
        </TooltipPortal>
      </TooltipPrimitive.Root>
    </TooltipProvider>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, TooltipPortal, ResponsiveTooltip };
