import { Info, X } from 'lucide-react';
import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipPortal,
  TooltipTrigger
} from '../../../../components/ui/tooltip';
import {
  Popover,
  PopoverArrow,
  PopoverClose,
  PopoverContent,
  PopoverTrigger
} from '../../../../components/ui/popover';
import { Text } from '@widgets/shared/components/ui/Typography';
import { useIsTouchDevice } from '@jetstreamgg/sky-utils';

export function InfoTooltip({
  content,
  contentClassname,
  trigger,
  iconClassName,
  iconSize = 13,
  shouldShowCloseButton = false
}: {
  content: string | React.ReactNode;
  contentClassname?: string;
  trigger?: React.ReactNode;
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
        {trigger || <Info size={iconSize} className={iconClassName} />}
      </PopoverTrigger>
      <PopoverContent
        align="center"
        side="top"
        className={`bg-containerDark rounded-xl backdrop-blur-[50px] ${contentClassname}`}
      >
        {shouldShowCloseButton && (
          <PopoverClose onClick={e => e.stopPropagation()} className="absolute top-4 right-4 z-10">
            <X className="h-5 w-5 cursor-pointer text-white" />
          </PopoverClose>
        )}
        <div
          className="scrollbar-thin max-h-[calc(var(--radix-popover-content-available-height)-64px)] overflow-y-auto"
          onWheel={e => e.stopPropagation()}
          onTouchMove={e => e.stopPropagation()}
        >
          {typeof content === 'string' ? <Text>{content}</Text> : content}
        </div>
        <PopoverArrow />
      </PopoverContent>
    </Popover>
  ) : (
    <Tooltip>
      <TooltipTrigger aria-label="Show additional information">
        {trigger || <Info size={iconSize} className={iconClassName} />}
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent className={`max-w-[400px] ${contentClassname}`} arrowPadding={10}>
          <div className="scrollbar-thin max-h-[calc(var(--radix-tooltip-content-available-height)-64px)] overflow-y-auto">
            {typeof content === 'string' ? <Text>{content}</Text> : content}
          </div>
          <TooltipArrow width={12} height={8} />
        </TooltipContent>
      </TooltipPortal>
    </Tooltip>
  );
}
