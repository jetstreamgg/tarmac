import { Info, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipPortal, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from './ui/popover';
import { useIsTouchDevice } from '@/hooks';

/**
 * Info glyph opening the design-system Tooltip (Figma 5043:58210). Desktop
 * hovers the Radix tooltip; touch devices, which can't hover, tap a Popover
 * wearing the same chrome. Body-only is the Simple type; pass `title` for the
 * Default type (5043:58197): Label 5 heading over fg-secondary body copy.
 */
export function InfoTooltip({
  title,
  content,
  contentClassname,
  iconClassName,
  iconSize = 13,
  shouldShowCloseButton = false
}: {
  title?: React.ReactNode;
  content: string | React.ReactNode;
  contentClassname?: string;
  iconClassName?: string;
  iconSize?: number;
  shouldShowCloseButton?: boolean;
}) {
  const isTouchDevice = useIsTouchDevice();

  const body = (
    <div className={title ? 'text-fgSecondary flex flex-col gap-2' : undefined}>
      {title && (
        <p className="font-circle text-fgPrimary text-sm leading-4 font-medium tracking-[-0.28px]">{title}</p>
      )}
      {typeof content === 'string' ? <p>{content}</p> : content}
    </div>
  );

  return isTouchDevice ? (
    <Popover>
      <PopoverTrigger
        onClick={e => e.stopPropagation()}
        className="z-10"
        aria-label="Show additional information"
      >
        <Info size={iconSize} className={iconClassName} />
      </PopoverTrigger>
      {/* Touch fallback mirrors the DS tooltip chrome (Figma 5043:57748). */}
      <PopoverContent
        align="center"
        side="top"
        className={`bg-bgTertiary text-fgPrimary font-graphik w-auto max-w-[260px] rounded-2xl text-[11px] leading-4 font-normal backdrop-blur-[20px] ${contentClassname}`}
      >
        {shouldShowCloseButton && (
          <PopoverClose onClick={e => e.stopPropagation()} className="absolute top-4 right-4 z-10">
            <X className="text-text h-5 w-5 cursor-pointer" />
          </PopoverClose>
        )}
        <div
          className="max-h-[calc(var(--radix-popover-content-available-height)-64px)] overflow-y-auto"
          onWheel={e => e.stopPropagation()}
          onTouchMove={e => e.stopPropagation()}
        >
          {body}
        </div>
      </PopoverContent>
    </Popover>
  ) : (
    // Own provider (same 300ms delay as the app root's, which nests harmlessly
    // under it) so the trigger is self-contained on any surface — pages, cards,
    // full-page takeovers, tests — with no host setup. Same precedent as
    // RiskTierDetailsTrigger.
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger aria-label="Show additional information">
          <Info size={iconSize} className={iconClassName} />
        </TooltipTrigger>
        <TooltipPortal>
          <TooltipContent className={contentClassname}>
            <div className="max-h-[calc(var(--radix-tooltip-content-available-height)-64px)] overflow-y-auto">
              {body}
            </div>
          </TooltipContent>
        </TooltipPortal>
      </Tooltip>
    </TooltipProvider>
  );
}
