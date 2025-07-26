import { Info, X } from 'lucide-react';
import { Tooltip, TooltipArrow, TooltipContent, TooltipPortal, TooltipTrigger } from './ui/tooltip';
import { Popover, PopoverArrow, PopoverClose, PopoverContent, PopoverTrigger } from './ui/popover';
import { useIsTouchDevice } from '@jetstreamgg/sky-utils';

export function InfoTooltip({
  content,
  contentClassname,
  iconClassName,
  iconSize = 13,
  shouldShowCloseButton = false
}: {
  content: string | React.ReactNode;
  contentClassname?: string;
  iconClassName?: string;
  iconSize?: number;
  shouldShowCloseButton?: boolean;
}) {
  const isTouchDevice = useIsTouchDevice();

  return isTouchDevice ? (
    <Popover>
      <PopoverTrigger
        onClick={e => e.stopPropagation()}
        className="z-10"
        aria-label="Show additional information"
      >
        <Info size={iconSize} className={iconClassName} />
      </PopoverTrigger>
      <PopoverContent
        align="center"
        side="top"
        className={`bg-containerDark rounded-xl backdrop-blur-[50px] ${contentClassname}`}
      >
        {shouldShowCloseButton && (
          <PopoverClose onClick={e => e.stopPropagation()} className="absolute right-4 top-4 z-10">
            <X className="h-5 w-5 cursor-pointer text-white" />
          </PopoverClose>
        )}
        <div
          className="scrollbar-thin max-h-[calc(var(--radix-popover-content-available-height)-64px)] overflow-y-auto"
          onWheel={e => e.stopPropagation()}
          onTouchMove={e => e.stopPropagation()}
        >
          {typeof content === 'string' ? <p>{content}</p> : content}
        </div>
        <PopoverArrow />
      </PopoverContent>
    </Popover>
  ) : (
    <Tooltip>
      <TooltipTrigger aria-label="Show additional information">
        <Info size={iconSize} className={iconClassName} />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent className={`max-w-[400px] ${contentClassname}`} arrowPadding={10}>
          <div className="scrollbar-thin max-h-[calc(var(--radix-tooltip-content-available-height)-64px)] overflow-y-auto">
            {typeof content === 'string' ? <p>{content}</p> : content}
          </div>
          <TooltipArrow width={12} height={8} />
        </TooltipContent>
      </TooltipPortal>
    </Tooltip>
  );
}
